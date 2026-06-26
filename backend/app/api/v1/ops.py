from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings
from app.services.email_sender import process_due_enrollments
from app.services.signals import run_all_enabled_sources

router = APIRouter(tags=["ops"])


@router.post("/tick")
async def tick(
    secret: str = Query(...),
    signals: bool = Query(False),
) -> dict:
    """Drive the scheduler externally (e.g. a free cron service) so sends fire
    even while the in-process loop is asleep on free hosting. Guarded by
    cron_secret — set CRON_SECRET and point a cron at
    POST /api/v1/tick?secret=...&signals=false every few minutes."""
    if not settings.cron_secret or secret != settings.cron_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="bad secret"
        )
    processed = await process_due_enrollments()
    new_signals = None
    if signals:
        new_signals = await run_all_enabled_sources()
    return {"processed": processed, "new_signals": new_signals}
