from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.linkedin_account import LinkedInAccount
from app.schemas.linkedin_accounts import (
    LinkedInAccountCreate,
    LinkedInAccountUpdate,
)
from app.services import linkedin as voyager
from app.services.crypto import encrypt


async def list_accounts(db: AsyncSession, user_id: int) -> list[LinkedInAccount]:
    res = await db.execute(
        select(LinkedInAccount)
        .where(LinkedInAccount.user_id == user_id)
        .order_by(LinkedInAccount.created_at.desc())
    )
    return list(res.scalars().all())


async def get_account(
    db: AsyncSession, user_id: int, account_id: int
) -> LinkedInAccount | None:
    res = await db.execute(
        select(LinkedInAccount).where(
            LinkedInAccount.id == account_id,
            LinkedInAccount.user_id == user_id,
        )
    )
    return res.scalar_one_or_none()


async def create_account(
    db: AsyncSession, user_id: int, payload: LinkedInAccountCreate
) -> LinkedInAccount:
    obj = LinkedInAccount(
        user_id=user_id,
        name=payload.name,
        li_at_enc=encrypt(payload.li_at),
        jsessionid_enc=encrypt(payload.jsessionid),
        proxy_url=payload.proxy_url,
        daily_limit_invites=payload.daily_limit_invites,
        daily_limit_messages=payload.daily_limit_messages,
        status="disconnected",
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_account(
    db: AsyncSession, account: LinkedInAccount, payload: LinkedInAccountUpdate
) -> LinkedInAccount:
    data = payload.model_dump(exclude_unset=True)
    if "li_at" in data:
        val = data.pop("li_at")
        if val:
            account.li_at_enc = encrypt(val)
            account.status = "disconnected"
    if "jsessionid" in data:
        val = data.pop("jsessionid")
        if val:
            account.jsessionid_enc = encrypt(val)
            account.status = "disconnected"
    for k, v in data.items():
        setattr(account, k, v)
    await db.commit()
    await db.refresh(account)
    return account


async def delete_account(db: AsyncSession, account: LinkedInAccount) -> None:
    await db.delete(account)
    await db.commit()


async def test_account(
    db: AsyncSession, account: LinkedInAccount
) -> tuple[bool, str]:
    """Verify the LinkedIn session via Voyager /me. Records status / identity /
    last_error. Returns (ok, detail)."""
    now = datetime.now(timezone.utc)
    try:
        info = await voyager.verify_session(account)
        account.status = "connected"
        account.last_error = None
        account.last_check_at = now
        if info.get("member_urn"):
            account.member_urn = info["member_urn"]
        if info.get("name") and not account.name:
            account.name = info["name"]
        await db.commit()
        who = account.name or info.get("name") or "konto"
        return True, f"Połączono z LinkedIn jako {who}."
    except Exception as e:  # noqa: BLE001 — surface the failure to the user
        detail = str(e)[:1000]
        account.status = "error"
        account.last_error = detail
        account.last_check_at = now
        await db.commit()
        return False, detail


def has_session(account: LinkedInAccount) -> bool:
    return bool(account.li_at_enc and account.jsessionid_enc)
