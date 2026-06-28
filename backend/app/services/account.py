"""Account / billing service — profile, password, plan usage, Stripe checkout.

Stripe is optional: when `stripe_secret_key` is empty, checkout returns a
preview response and the UI shows plans without charging.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.email_account import EmailAccount
from app.models.lead import Lead
from app.models.lead_list import LeadList
from app.models.message import Message
from app.models.signal_source import SignalSource
from app.models.user import User
from app.plans import ORDER, get_plan
from app.services.auth import hash_password, verify_password


def billing_enabled() -> bool:
    return bool(settings.stripe_secret_key)


# ---------- Profile ----------


async def update_profile(
    db: AsyncSession, user: User, name, email
) -> User:
    if name is not None:
        user.name = name.strip() or None
    if email is not None and email.lower() != user.email.lower():
        # Ensure email isn't taken.
        existing = (
            await db.execute(
                select(User).where(func.lower(User.email) == email.lower())
            )
        ).scalar_one_or_none()
        if existing is not None and existing.id != user.id:
            raise ValueError("Ten adres e-mail jest już zajęty.")
        user.email = email
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise ValueError("Obecne hasło jest nieprawidłowe.")
    user.hashed_password = hash_password(new_password)
    await db.commit()


# ---------- Usage ----------


async def _count(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


async def compute_usage(db: AsyncSession, user: User) -> dict[str, int]:
    leads = await _count(
        db,
        select(func.count(Lead.id))
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(LeadList.user_id == user.id),
    )
    mailboxes = await _count(
        db,
        select(func.count(EmailAccount.id)).where(
            EmailAccount.user_id == user.id
        ),
    )
    sources = await _count(
        db,
        select(func.count(SignalSource.id)).where(
            SignalSource.user_id == user.id
        ),
    )
    sends_today = await _count(
        db,
        select(func.count(Message.id))
        .join(
            CampaignEnrollment,
            CampaignEnrollment.id == Message.enrollment_id,
        )
        .join(Campaign, Campaign.id == CampaignEnrollment.campaign_id)
        .where(
            Campaign.user_id == user.id,
            Message.status == "sent",
            func.date(Message.sent_at) == func.current_date(),
        ),
    )
    return {
        "leads": leads,
        "mailboxes": mailboxes,
        "signal_sources": sources,
        "daily_sends": sends_today,
    }


_USAGE_LABELS = {
    "leads": "Leady",
    "mailboxes": "Skrzynki",
    "daily_sends": "Wysyłki dziś",
    "signal_sources": "Źródła sygnałów",
}


async def overview(db: AsyncSession, user: User) -> dict:
    usage = await compute_usage(db, user)
    plan = get_plan(user.plan)
    limits = plan["limits"]
    usage_rows = [
        {
            "key": k,
            "label": _USAGE_LABELS[k],
            "used": usage.get(k, 0),
            "limit": limits.get(k),
        }
        for k in ("leads", "mailboxes", "daily_sends", "signal_sources")
    ]
    plans = []
    for key in ORDER:
        p = get_plan(key)
        plans.append(
            {
                "key": p["key"],
                "name": p["name"],
                "price_pln": p["price_pln"],
                "period": p["period"],
                "features": p["features"],
                "status": "current" if key == user.plan else "available",
                "is_current": key == user.plan,
                "can_checkout": bool(billing_enabled() and p["stripe_price_id"]),
            }
        )
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "plan": user.plan,
        "plan_status": user.plan_status,
        "billing_enabled": billing_enabled(),
        "usage": usage_rows,
        "plans": plans,
    }


# ---------- Stripe checkout ----------


async def create_checkout(db: AsyncSession, user: User, plan_key: str) -> dict:
    plan = get_plan(plan_key)
    price_id = plan.get("stripe_price_id")
    if not billing_enabled() or not price_id:
        return {
            "preview": True,
            "url": None,
            "message": (
                "Płatności online nie są jeszcze skonfigurowane (brak kluczy "
                "Stripe). Plan zapiszemy po podłączeniu Stripe — patrz "
                "TODO_USER.md. Aby porozmawiać o planie Scale, napisz do nas."
            ),
        }
    # Lazy import so the app runs without the stripe package when unused.
    import stripe

    stripe.api_key = settings.stripe_secret_key
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(email=user.email, name=user.name or "")
        user.stripe_customer_id = customer.id
        await db.commit()
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=user.stripe_customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.app_base_url}/account/billing?status=success",
        cancel_url=f"{settings.app_base_url}/account/billing?status=cancel",
        metadata={"user_id": str(user.id), "plan": plan_key},
    )
    return {"preview": False, "url": session.url, "message": None}


async def billing_portal(db: AsyncSession, user: User) -> str | None:
    if not billing_enabled() or not user.stripe_customer_id:
        return None
    import stripe

    stripe.api_key = settings.stripe_secret_key
    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.app_base_url}/account/billing",
    )
    return session.url
