"""CRM provider connections (Livespace / HubSpot / Pipedrive / Salesforce).

Connection scaffold + push targets for the sequence-goal feature. Credentials
stored encrypted. The actual push (create contact/task/deal) is implemented once
real credentials are supplied — `push()` falls back to the generic webhook
(services.webhooks) so goals already do something useful today.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm_integration import CrmIntegration
from app.services.crypto import decrypt, encrypt

logger = logging.getLogger(__name__)

PROVIDERS: dict[str, dict] = {
    "livespace": {
        "key": "livespace",
        "name": "Livespace",
        "description": (
            "Polski CRM dla zespołów sprzedaży. Dodawanie kontaktów, zadań i "
            "szans sprzedaży przez API."
        ),
        "docs_url": "https://docs.livespace.io/",
        "key_hint": "Livespace → Ustawienia → API → klucz + sekret + domena konta",
        "needs_domain": True,
        "actions": ["contact", "task", "deal"],
    },
    "hubspot": {
        "key": "hubspot",
        "name": "HubSpot",
        "description": (
            "Kontakty, firmy i deale. Push przez Private App token; eventy jako "
            "engagements."
        ),
        "docs_url": "https://developers.hubspot.com/docs/api/private-apps",
        "key_hint": "HubSpot → Settings → Integrations → Private Apps → token",
        "needs_domain": False,
        "actions": ["contact", "task", "deal"],
    },
    "pipedrive": {
        "key": "pipedrive",
        "name": "Pipedrive",
        "description": (
            "Person/Deal/Activity API. Push leadów jako Person, celów jako Deal "
            "lub Activity."
        ),
        "docs_url": "https://developers.pipedrive.com/docs/api/v1",
        "key_hint": "Pipedrive → Settings → Personal → API → token (+ domena firmy)",
        "needs_domain": True,
        "actions": ["contact", "task", "deal"],
    },
    "salesforce": {
        "key": "salesforce",
        "name": "Salesforce",
        "description": (
            "Lead/Contact/Opportunity/Task. Połączenie OAuth — pełny mechanizm "
            "po przekazaniu danych aplikacji połączonej."
        ),
        "docs_url": "https://developer.salesforce.com/docs/apis",
        "key_hint": "Salesforce → Setup → Connected App / token dostępu",
        "needs_domain": True,
        "actions": ["contact", "task", "deal"],
    },
}

ACTION_LABELS = {
    "contact": "Kontakt",
    "task": "Zadanie dla handlowca",
    "deal": "Szansa sprzedaży",
}


def is_provider(p: str) -> bool:
    return p in PROVIDERS


async def _get(db, user_id, provider) -> CrmIntegration | None:
    return (
        await db.execute(
            select(CrmIntegration).where(
                CrmIntegration.user_id == user_id,
                CrmIntegration.provider == provider,
            )
        )
    ).scalar_one_or_none()


def _mask(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 6:
        return "••••"
    return f"{key[:3]}••••{key[-3:]}"


async def list_status(db: AsyncSession, user_id: int) -> list[dict]:
    rows = (
        await db.execute(
            select(CrmIntegration).where(CrmIntegration.user_id == user_id)
        )
    ).scalars().all()
    by = {r.provider: r for r in rows}
    out: list[dict] = []
    for key, meta in PROVIDERS.items():
        row = by.get(key)
        out.append(
            {
                **meta,
                "connected": bool(row and row.api_key_enc),
                "enabled": bool(row.enabled) if row else False,
                "key_masked": _mask(decrypt(row.api_key_enc)) if row else None,
                "domain": (row.extra or {}).get("domain") if row else None,
            }
        )
    return out


async def connect(
    db: AsyncSession,
    user_id: int,
    provider: str,
    api_key: str,
    domain: str | None = None,
) -> CrmIntegration:
    row = await _get(db, user_id, provider)
    enc = encrypt(api_key.strip())
    extra = {"domain": domain.strip()} if domain else {}
    if row is None:
        row = CrmIntegration(
            user_id=user_id,
            provider=provider,
            api_key_enc=enc,
            extra=extra,
            enabled=True,
        )
        db.add(row)
    else:
        row.api_key_enc = enc
        if domain is not None:
            row.extra = {**(row.extra or {}), "domain": domain.strip()}
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


async def connected_providers(db: AsyncSession, user_id: int) -> list[str]:
    rows = (
        await db.execute(
            select(CrmIntegration.provider).where(
                CrmIntegration.user_id == user_id,
                CrmIntegration.enabled.is_(True),
                CrmIntegration.api_key_enc.isnot(None),
            )
        )
    ).all()
    return [r[0] for r in rows]


# ---------- Push (stub → generic webhook fallback) ----------


async def push(
    db: AsyncSession,
    user_id: int,
    provider: str | None,
    action: str,
    payload: dict,
) -> dict:
    """Create a contact/task/deal in the CRM. Until per-provider API calls are
    wired, this fires the generic webhook (services.webhooks) with a
    `crm_<action>` event so the goal still flows out to Zapier/Make/n8n/CRM.
    Returns {delivered, via}."""
    from app.services.webhooks import fire

    event = f"crm_{action}"
    data = {"provider": provider, "action": action, **payload}
    await fire(db, user_id, event, data)
    logger.info(
        "CRM push (webhook fallback) user=%s provider=%s action=%s",
        user_id,
        provider,
        action,
    )
    return {"delivered": True, "via": "webhook"}
