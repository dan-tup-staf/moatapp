from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.account import (
    AccountOverview,
    CheckoutRequest,
    CheckoutResponse,
    PasswordChange,
    ProfileUpdate,
)
from app.schemas.auth import UserRead
from app.services import account as svc

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/overview", response_model=AccountOverview)
async def get_overview(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountOverview:
    return AccountOverview(**await svc.overview(db, current))


@router.patch("/profile", response_model=UserRead)
async def update_profile(
    payload: ProfileUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        return await svc.update_profile(db, current, payload.name, payload.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChange,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await svc.change_password(
            db, current, payload.current_password, payload.new_password
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    try:
        data = await svc.create_checkout(db, current, payload.plan)
    except Exception as e:  # noqa: BLE001 — surface Stripe errors cleanly
        raise HTTPException(
            status_code=400, detail=f"Błąd płatności: {type(e).__name__}: {e}"
        ) from None
    return CheckoutResponse(**data)


@router.post("/billing-portal", response_model=CheckoutResponse)
async def portal(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    url = await svc.billing_portal(db, current)
    if url is None:
        return CheckoutResponse(
            preview=True,
            message="Portal płatności dostępny po podłączeniu Stripe.",
        )
    return CheckoutResponse(url=url)


@router.post("/stripe-webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Stripe → MOATION sync. Updates User.plan / plan_status on subscription
    lifecycle events. No-op when Stripe isn't configured."""
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        return {"ok": False, "reason": "stripe-not-configured"}

    import stripe
    from sqlalchemy import select

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.stripe_webhook_secret
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid webhook: {e}") from None

    obj = event["data"]["object"]
    etype = event["type"]

    async def _user_by_customer(cid):
        if not cid:
            return None
        return (
            await db.execute(
                select(User).where(User.stripe_customer_id == cid)
            )
        ).scalar_one_or_none()

    if etype == "checkout.session.completed":
        uid = (obj.get("metadata") or {}).get("user_id")
        plan = (obj.get("metadata") or {}).get("plan", "pro")
        user = await db.get(User, int(uid)) if uid else None
        if user is not None:
            user.plan = plan
            user.plan_status = "active"
            user.stripe_customer_id = obj.get("customer") or user.stripe_customer_id
            user.stripe_subscription_id = obj.get("subscription")
            await db.commit()
    elif etype in (
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        user = await _user_by_customer(obj.get("customer"))
        if user is not None:
            status_val = obj.get("status", "active")
            user.plan_status = status_val
            if etype.endswith("deleted") or status_val in (
                "canceled",
                "unpaid",
            ):
                user.plan = "free"
            await db.commit()

    return {"ok": True}
