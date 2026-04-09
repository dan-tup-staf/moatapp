import logging

from app.services.email_sender import process_due_enrollments

logger = logging.getLogger(__name__)


async def send_due_emails(ctx: dict) -> dict:
    """ARQ task — runs on a cron schedule, processes any enrollments whose
    next_send_at has passed."""
    count = await process_due_enrollments()
    if count > 0:
        logger.info("send_due_emails: processed %d enrollments", count)
    return {"processed": count}
