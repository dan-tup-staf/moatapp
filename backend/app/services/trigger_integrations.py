"""Goal-trigger integrations (Calendly / Google Calendar).

Connection scaffold for the sequence goal's meeting triggers. Calendly connects
with a Personal Access Token; Google Calendar needs OAuth (finished once app
credentials are supplied). Tokens stored encrypted.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trigger_integration import TriggerIntegration
from app.services.crypto import decrypt, encrypt

PROVIDERS: dict[str, dict] = {
    "calendly": {
        "key": "calendly",
        "name": "Calendly",
        "description": (
            "Wykrywanie umówionych spotkań. Połącz Personal Access Token; "
            "rejestrujemy webhook invitee.created jako trigger celu."
        ),
        "docs_url": "https://developer.calendly.com/api-docs",
        "connect_kind": "token",
        "key_hint": "Calendly → Integrations → API & Webhooks → Personal Access Token",
    },
    "google_calendar": {
        "key": "google_calendar",
        "name": "Google Calendar",
        "description": (
            "Potwierdzenie spotkania w kalendarzu Google. Połączenie OAuth — "
            "pełne wykrywanie po przekazaniu danych aplikacji Google."
        ),
        "docs_url": "https://developers.google.com/calendar/api",
        "connect_kind": "oauth",
        "key_hint": "Wymaga aplikacji OAuth w Google Cloud (client id/secret).",
    },
}


def is_provider(p: str) -> bool:
    return p in PROVIDERS


async def _get(db, user_id, provider) -> TriggerIntegration | None:
    return (
        await db.execute(
            select(TriggerIntegration).where(
                TriggerIntegration.user_id == user_id,
                TriggerIntegration.provider == provider,
            )
        )
    ).scalar_one_or_none()


def _mask(t: str | None) -> str | None:
    if not t:
        return None
    if len(t) <= 6:
        return "••••"
    return f"{t[:3]}••••{t[-3:]}"


async def list_status(db: AsyncSession, user_id: int) -> list[dict]:
    rows = (
        await db.execute(
            select(TriggerIntegration).where(
                TriggerIntegration.user_id == user_id
            )
        )
    ).scalars().all()
    by = {r.provider: r for r in rows}
    out: list[dict] = []
    for key, meta in PROVIDERS.items():
        row = by.get(key)
        out.append(
            {
                **meta,
                "connected": bool(row and row.token_enc),
                "token_masked": _mask(decrypt(row.token_enc)) if row else None,
            }
        )
    return out


async def connect(
    db: AsyncSession, user_id: int, provider: str, token: str
) -> TriggerIntegration:
    row = await _get(db, user_id, provider)
    enc = encrypt(token.strip())
    if row is None:
        row = TriggerIntegration(
            user_id=user_id, provider=provider, token_enc=enc, enabled=True
        )
        db.add(row)
    else:
        row.token_enc = enc
        row.enabled = True
    await db.commit()
    await db.refresh(row)
    return row


async def disconnect(db: AsyncSession, user_id: int, provider: str) -> bool:
    row = await _get(db, user_id, provider)
    if row is None:
        return False
    await db.delete(row)
    await db.commit()
    return True
