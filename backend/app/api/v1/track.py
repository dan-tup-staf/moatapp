import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.message import Message
from app.services.tracking import TRACK_GIF, click_sig, open_sig

router = APIRouter(prefix="/track", tags=["track"])

_GIF_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate"}


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
