from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_account import EmailAccount
from app.schemas.email_accounts import EmailAccountCreate, EmailAccountUpdate
from app.services.campaigns import join_tags, split_tags
from app.services.crypto import encrypt
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
        smtp_password_enc=encrypt(payload.smtp_password or ""),
        smtp_security=payload.smtp_security.value,
        imap_host=payload.imap_host,
        imap_port=payload.imap_port,
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
    from datetime import datetime, timezone

    data = payload.model_dump(exclude_unset=True)
    if "tags" in data and data["tags"] is not None:
        account.tags = join_tags(data.pop("tags"))
    if "warmup_status" in data and hasattr(data.get("warmup_status"), "value"):
        data["warmup_status"] = data["warmup_status"].value
    # Starting warm-up (re)starts the ramp clock.
    if data.get("warmup_status") == "warming" and (
        account.warmup_status != "warming" or account.warmup_started_at is None
    ):
        account.warmup_started_at = datetime.now(timezone.utc)
    if "smtp_security" in data and hasattr(data.get("smtp_security"), "value"):
        data["smtp_security"] = data["smtp_security"].value
    # A new password replaces the stored ciphertext; changing creds invalidates
    # the previous "verified" state. Omitting smtp_password keeps the old one.
    if "smtp_password" in data:
        pwd = data.pop("smtp_password")
        if pwd:
            account.smtp_password_enc = encrypt(pwd)
            account.verified = False
    for k, v in data.items():
        setattr(account, k, v)
    await db.commit()
    await db.refresh(account)
    return account


async def delete_account(db: AsyncSession, account: EmailAccount) -> None:
    await db.delete(account)
    await db.commit()


async def test_account(db: AsyncSession, account: EmailAccount) -> tuple[bool, str]:
    """Send a test email through the account's own SMTP. Records verified /
    last_error / last_test_at. Returns (ok, detail)."""
    from datetime import datetime, timezone

    from app.services.email_sender import send_account_test

    now = datetime.now(timezone.utc)
    try:
        await send_account_test(account)
        account.verified = True
        account.last_error = None
        account.last_test_at = now
        await db.commit()
        return True, f"Wysłano testowy mail na {account.email}. Sprawdź skrzynkę."
    except Exception as e:  # noqa: BLE001 — surface any SMTP error to the user
        detail = f"{type(e).__name__}: {e}"[:1000]
        account.verified = False
        account.last_error = detail
        account.last_test_at = now
        await db.commit()
        return False, detail


def tags_list(account: EmailAccount) -> list[str]:
    return split_tags(account.tags)


# ---------- Warm-up ramp ----------

# A warming mailbox starts low and grows each day so a fresh domain/IP builds
# reputation gradually instead of blasting at full volume on day one.
WARMUP_START_VOLUME = 5
WARMUP_DAILY_STEP = 5


def warmup_day(account: EmailAccount) -> int:
    """0-based day index since the ramp started (0 if not warming)."""
    from datetime import datetime, timezone

    if account.warmup_status != "warming" or not account.warmup_started_at:
        return 0
    started = account.warmup_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - started).days)


def effective_daily_limit(account: EmailAccount) -> int:
    """The cap to enforce today: during warm-up the volume ramps from
    WARMUP_START_VOLUME by WARMUP_DAILY_STEP/day up to the account's target
    daily_limit; otherwise the plain daily_limit."""
    if account.warmup_status != "warming" or not account.warmup_started_at:
        return account.daily_limit
    ramp = WARMUP_START_VOLUME + WARMUP_DAILY_STEP * warmup_day(account)
    return max(WARMUP_START_VOLUME, min(account.daily_limit, ramp))


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
