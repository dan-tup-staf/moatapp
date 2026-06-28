"""Outbound webhook delivery — push sales events to a user's CRM/automation.

Events are POSTed as JSON with an HMAC-SHA256 signature header so the receiver
can verify authenticity. Delivery is best-effort (failures are recorded, never
raised) so a broken endpoint can't block sending/reply processing.
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook import Webhook

logger = logging.getLogger(__name__)

# Known event names (UI offers these; empty selection = all).
EVENTS = [
    "lead_replied",
    "lead_bounced",
    "lead_unsubscribed",
    "outcome_changed",
]


def _wants(hook: Webhook, event: str) -> bool:
    sel = [e.strip() for e in (hook.events or "").split(",") if e.strip()]
    return not sel or event in sel


def sign(secret: str, body: bytes) -> str:
    return hmac.new(
        (secret or "").encode("utf-8"), body, hashlib.sha256
    ).hexdigest()


async def _post(hook: Webhook, event: str, data: dict, db: AsyncSession) -> None:
    payload = {
        "event": event,
        "data": data,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "content-type": "application/json",
        "x-moation-event": event,
        "x-moation-signature": "sha256=" + sign(hook.secret, body),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(hook.url, content=body, headers=headers)
        hook.last_status = r.status_code
        hook.last_error = None if r.status_code < 400 else r.text[:500]
    except Exception as e:  # noqa: BLE001
        logger.warning("webhook %s failed: %s", hook.id, e)
        hook.last_status = None
        hook.last_error = f"{type(e).__name__}: {e}"[:500]
    hook.last_fired_at = datetime.now(timezone.utc)


async def fire(db: AsyncSession, user_id: int, event: str, data: dict) -> None:
    """Deliver `event` to every active webhook of the user that subscribes to
    it. Best-effort; commits the delivery status."""
    hooks = (
        await db.execute(
            select(Webhook).where(
                Webhook.user_id == user_id, Webhook.active.is_(True)
            )
        )
    ).scalars().all()
    fired = False
    for hook in hooks:
        if _wants(hook, event):
            await _post(hook, event, data, db)
            fired = True
    if fired:
        await db.commit()


def lead_payload(lead) -> dict:
    return {
        "email": lead.email,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "company": lead.company,
        "title": lead.title,
        "linkedin_url": getattr(lead, "linkedin_url", None),
    }


# ---------- CRUD ----------


async def list_hooks(db: AsyncSession, user_id: int) -> list[Webhook]:
    return list(
        (
            await db.execute(
                select(Webhook)
                .where(Webhook.user_id == user_id)
                .order_by(Webhook.created_at.desc())
            )
        ).scalars().all()
    )


async def get_hook(db: AsyncSession, user_id: int, hid: int) -> Webhook | None:
    return (
        await db.execute(
            select(Webhook).where(
                Webhook.id == hid, Webhook.user_id == user_id
            )
        )
    ).scalar_one_or_none()


async def create_hook(
    db: AsyncSession, user_id: int, url: str, secret: str, events: list[str]
) -> Webhook:
    obj = Webhook(
        user_id=user_id,
        url=url,
        secret=secret,
        events=",".join(events),
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_hook(db: AsyncSession, hook: Webhook) -> None:
    await db.delete(hook)
    await db.commit()


async def test_hook(db: AsyncSession, hook: Webhook) -> tuple[bool, str]:
    await _post(
        hook,
        "test",
        {"message": "Testowe zdarzenie z MOATION"},
        db,
    )
    await db.commit()
    ok = hook.last_status is not None and hook.last_status < 400
    return ok, (
        f"HTTP {hook.last_status}" if hook.last_status else (hook.last_error or "błąd")
    )
