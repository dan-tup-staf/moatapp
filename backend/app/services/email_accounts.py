from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_account import EmailAccount
from app.schemas.email_accounts import EmailAccountCreate, EmailAccountUpdate
from app.services.campaigns import join_tags, split_tags
from app.services.domain_health import check_domain, normalize_domain


async def list_accounts(db: AsyncSession, user_id: int) -> list[EmailAccount]:
    res = await db.execute(
        select(EmailAccount)
        .where(EmailAccount.user_id == user_id)
        .order_by(EmailAccount.created_at.desc())
    )
    return list(res.scalars().all())


async def get_account(
    db: AsyncSession, user_id: int, account_id: int
) -> EmailAccount | None:
    res = await db.execute(
        select(EmailAccount).where(
            EmailAccount.id == account_id, EmailAccount.user_id == user_id
        )
    )
    return res.scalar_one_or_none()


async def get_by_email(
    db: AsyncSession, user_id: int, email: str
) -> EmailAccount | None:
    res = await db.execute(
        select(EmailAccount).where(
            EmailAccount.user_id == user_id, EmailAccount.email == email
        )
    )
    return res.scalar_one_or_none()


async def create_account(
    db: AsyncSession, user_id: int, payload: EmailAccountCreate
) -> EmailAccount:
    obj = EmailAccount(
        user_id=user_id,
        email=str(payload.email).lower(),
        from_name=payload.from_name,
        provider=payload.provider,
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        smtp_username=payload.smtp_username,
        daily_limit=payload.daily_limit,
        tags=join_tags(payload.tags),
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_account(
    db: AsyncSession, account: EmailAccount, payload: EmailAccountUpdate
) -> EmailAccount:
    data = payload.model_dump(exclude_unset=True)
    if "tags" in data and data["tags"] is not None:
        account.tags = join_tags(data.pop("tags"))
    if "warmup_status" in data and hasattr(data.get("warmup_status"), "value"):
        data["warmup_status"] = data["warmup_status"].value
    for k, v in data.items():
        setattr(account, k, v)
    await db.commit()
    await db.refresh(account)
    return account


async def delete_account(db: AsyncSession, account: EmailAccount) -> None:
    await db.delete(account)
    await db.commit()


def tags_list(account: EmailAccount) -> list[str]:
    return split_tags(account.tags)


# Setup score weights (sum = 100)
_WEIGHTS = {"spf": 25, "dkim": 25, "dmarc": 20, "mx": 10}


async def setup_score(account: EmailAccount) -> dict:
    """Combine DNS health (SPF/DKIM/DMARC/MX via DoH on the email's domain)
    with SMTP config completeness into a 0-100 setup score."""
    domain = normalize_domain(account.email)
    health = await check_domain(domain)
    health_checks = health.get("checks", {})

    checks: dict[str, dict] = {}
    score = 0
    for key, weight in _WEIGHTS.items():
        c = health_checks.get(key, {})
        ok = bool(c.get("ok"))
        if ok:
            score += weight
        checks[key] = {
            "ok": ok,
            "detail": c.get("detail", ""),
        }

    smtp_ok = bool(account.smtp_host)
    if smtp_ok:
        score += 10
    checks["smtp"] = {
        "ok": smtp_ok,
        "detail": account.smtp_host
        or "Brak hosta SMTP — uzupełnij, by skrzynka mogła wysyłać",
    }

    name_ok = bool(account.from_name)
    if name_ok:
        score += 10
    checks["from_name"] = {
        "ok": name_ok,
        "detail": account.from_name or "Brak nazwy nadawcy (From name)",
    }

    return {
        "domain": domain,
        "score": score,
        "max_score": 100,
        "checks": checks,
    }
