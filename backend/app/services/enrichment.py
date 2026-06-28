"""Data-enrichment provider connections (Apollo / Lusha / Prospeo).

This is the connection scaffold: users connect a provider by saving an API key
(stored encrypted). The actual enrichment calls are implemented once a real key
is available — `enrich_contact()` is intentionally a stub that reports the
provider is connected but the mechanism is not live yet.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enrichment_integration import EnrichmentIntegration
from app.services.crypto import decrypt, encrypt

# Provider catalogue — single source of truth for the UI cards.
PROVIDERS: dict[str, dict] = {
    "apollo": {
        "key": "apollo",
        "name": "Apollo.io",
        "description": (
            "Wyszukiwanie firm i osób + wzbogacanie e-maili. Duża baza B2B, "
            "dobry do budowania list i znajdowania maili po LinkedIn/domenie."
        ),
        "docs_url": "https://docs.apollo.io/reference/introduction",
        "key_hint": "Apollo → Settings → Integrations → API → API Key",
        "capabilities": ["E-maile", "Telefony", "Firmy", "Osoby"],
    },
    "lusha": {
        "key": "lusha",
        "name": "Lusha",
        "description": (
            "Wzbogacanie kontaktów: e-mail i telefon po imieniu+firmie lub "
            "profilu LinkedIn. Wysoka trafność danych kontaktowych."
        ),
        "docs_url": "https://www.lusha.com/docs/",
        "key_hint": "Lusha → Account → API → wygeneruj klucz (plan z API)",
        "capabilities": ["E-maile", "Telefony"],
    },
    "prospeo": {
        "key": "prospeo",
        "name": "Prospeo",
        "description": (
            "Email finder: domena + imię/nazwisko lub URL LinkedIn → e-mail. "
            "Tani, dobry jako pierwszy krok w łańcuchu wzbogacania."
        ),
        "docs_url": "https://prospeo.io/api/documentation",
        "key_hint": "Prospeo → Dashboard → API → API Key",
        "capabilities": ["E-maile"],
    },
}


def is_provider(provider: str) -> bool:
    return provider in PROVIDERS


async def _get(
    db: AsyncSession, user_id: int, provider: str
) -> EnrichmentIntegration | None:
    return (
        await db.execute(
            select(EnrichmentIntegration).where(
                EnrichmentIntegration.user_id == user_id,
                EnrichmentIntegration.provider == provider,
            )
        )
    ).scalar_one_or_none()


async def list_status(db: AsyncSession, user_id: int) -> list[dict]:
    rows = (
        await db.execute(
            select(EnrichmentIntegration).where(
                EnrichmentIntegration.user_id == user_id
            )
        )
    ).scalars().all()
    by_provider = {r.provider: r for r in rows}
    out: list[dict] = []
    for key, meta in PROVIDERS.items():
        row = by_provider.get(key)
        out.append(
            {
                **meta,
                "connected": bool(row and row.api_key_enc),
                "enabled": bool(row.enabled) if row else False,
                # Show only a masked hint, never the real key.
                "key_masked": _mask(decrypt(row.api_key_enc)) if row else None,
            }
        )
    return out


def _mask(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 6:
        return "••••"
    return f"{key[:3]}••••{key[-3:]}"


async def connect(
    db: AsyncSession, user_id: int, provider: str, api_key: str
) -> EnrichmentIntegration:
    row = await _get(db, user_id, provider)
    enc = encrypt(api_key.strip())
    if row is None:
        row = EnrichmentIntegration(
            user_id=user_id, provider=provider, api_key_enc=enc, enabled=True
        )
        db.add(row)
    else:
        row.api_key_enc = enc
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


async def set_enabled(
    db: AsyncSession, user_id: int, provider: str, enabled: bool
) -> EnrichmentIntegration | None:
    row = await _get(db, user_id, provider)
    if row is None:
        return None
    row.enabled = enabled
    await db.commit()
    await db.refresh(row)
    return row


async def get_api_key(
    db: AsyncSession, user_id: int, provider: str
) -> str | None:
    row = await _get(db, user_id, provider)
    if row is None or not row.enabled:
        return None
    return decrypt(row.api_key_enc)


# ---------- Enrichment (stub until a real key is wired) ----------


class EnrichmentNotReady(Exception):
    """Raised when enrichment is requested but the mechanism isn't live yet."""


async def enrich_contact(
    db: AsyncSession, user_id: int, provider: str, query: dict
) -> dict:
    """Placeholder. Once a real API key is provided we implement the actual
    per-provider HTTP calls here. For now: confirm the connection and report
    the mechanism is pending so the UI can show honest status."""
    key = await get_api_key(db, user_id, provider)
    raise EnrichmentNotReady(
        "Integracja podłączona, ale mechanizm wzbogacania jest jeszcze w "
        "budowie — dokończymy go po przekazaniu klucza API i uruchomieniu "
        f"połączenia z {PROVIDERS.get(provider, {}).get('name', provider)}."
        + ("" if key else " (brak zapisanego klucza)")
    )
