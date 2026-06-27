import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.lead import Lead
from app.models.message import Message
from app.services.tracking import TRACK_GIF, click_sig, open_sig, unsub_sig

router = APIRouter(prefix="/track", tags=["track"])

_GIF_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate"}


def _unsub_page(done: bool) -> str:
    msg = (
        "Zostałeś wypisany. Nie otrzymasz już od nas wiadomości."
        if done
        else "Ten link wypisu jest nieprawidłowy lub wygasł."
    )
    return (
        "<!doctype html><html lang='pl'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Wypis</title></head>"
        "<body style='font-family:system-ui,sans-serif;background:#f9fafb;"
        "margin:0;display:flex;min-height:100vh;align-items:center;"
        "justify-content:center'>"
        "<div style='background:#fff;border:1px solid #e5e7eb;border-radius:16px;"
        "padding:40px;max-width:420px;text-align:center'>"
        f"<div style='font-size:40px'>{'✓' if done else '⚠️'}</div>"
        f"<p style='color:#374151;font-size:15px;margin-top:12px'>{msg}</p>"
        "</div></body></html>"
    )


async def _do_unsubscribe(tracker: str, db: AsyncSession) -> bool:
    """Validate the signed token and mark the lead unsubscribed + stop their
    active enrollments. Returns True when a valid lead was unsubscribed."""
    name = tracker.split(".")[0]
    if "-" not in name:
        return False
    id_str, sig = name.rsplit("-", 1)
    if not id_str.isdigit() or not hmac.compare_digest(sig, unsub_sig(int(id_str))):
        return False
    lead = await db.get(Lead, int(id_str))
    if lead is None:
        return False
    if lead.status != "unsubscribed":
        lead.status = "unsubscribed"
        # Stop any in-flight sequences for this lead so we never email again.
        await db.execute(
            update(CampaignEnrollment)
            .where(
                CampaignEnrollment.lead_id == lead.id,
                CampaignEnrollment.status == "active",
            )
            .values(status="completed", next_send_at=None)
        )
        await db.commit()
    return True


@router.get("/open/{tracker}")
async def track_open(
    tracker: str, db: AsyncSession = Depends(get_db)
) -> Response:
    """Public 1x1 pixel. `tracker` is "<message_id>-<sig>.gif". Records the
    first open for a valid, signed message id. Always returns the GIF."""
    name = tracker.split(".")[0]
    if "-" in name:
        id_str, sig = name.rsplit("-", 1)
        if id_str.isdigit() and hmac.compare_digest(sig, open_sig(int(id_str))):
            msg = await db.get(Message, int(id_str))
            if msg is not None and msg.opened_at is None:
                msg.opened_at = datetime.now(timezone.utc)
                await db.commit()
    return Response(
        content=TRACK_GIF, media_type="image/gif", headers=_GIF_HEADERS
    )


@router.get("/click/{tracker}")
async def track_click(
    tracker: str, u: str, db: AsyncSession = Depends(get_db)
) -> Response:
    """Public click-tracking redirect. `tracker` is "<message_id>-<sig>", `u`
    is the URL-encoded target. Records the first click (and implies an open)
    for a valid signed message id, then 302-redirects to the target.

    Only http(s) targets are honoured — anything else falls back to "/" to
    avoid being abused as an open redirect to javascript:/data: schemes."""
    target = u if u.startswith("http://") or u.startswith("https://") else "/"

    name = tracker.split(".")[0]
    if "-" in name:
        id_str, sig = name.rsplit("-", 1)
        if id_str.isdigit() and hmac.compare_digest(
            sig, click_sig(int(id_str))
        ):
            msg = await db.get(Message, int(id_str))
            if msg is not None:
                now = datetime.now(timezone.utc)
                changed = False
                if msg.clicked_at is None:
                    msg.clicked_at = now
                    changed = True
                # A click necessarily implies the email was opened.
                if msg.opened_at is None:
                    msg.opened_at = now
                    changed = True
                if changed:
                    await db.commit()
    return RedirectResponse(target, status_code=302)


@router.get("/unsubscribe/{tracker}")
async def unsubscribe_page(
    tracker: str, db: AsyncSession = Depends(get_db)
) -> Response:
    """Public unsubscribe link (from the email footer). Marks the lead
    unsubscribed and shows a confirmation page."""
    done = await _do_unsubscribe(tracker, db)
    return HTMLResponse(content=_unsub_page(done))


@router.post("/unsubscribe/{tracker}")
async def unsubscribe_one_click(
    tracker: str, db: AsyncSession = Depends(get_db)
) -> Response:
    """RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Mail clients
    POST here without loading a page, so return 204."""
    await _do_unsubscribe(tracker, db)
    return Response(status_code=204)
