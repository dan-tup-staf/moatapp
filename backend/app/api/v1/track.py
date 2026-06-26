import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.message import Message
from app.services.tracking import TRACK_GIF, open_sig

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
