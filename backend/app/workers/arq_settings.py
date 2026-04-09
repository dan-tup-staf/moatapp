from arq import cron
from arq.connections import RedisSettings

from app.config import settings
from app.workers.email_tasks import send_due_emails
from app.workers.scraper_tasks import run_signal_scrapers


async def startup(ctx: dict) -> None:
    pass


async def shutdown(ctx: dict) -> None:
    pass


def _redis_settings_from_url(url: str) -> RedisSettings:
    # arq's RedisSettings expects host/port/database separately.
    from urllib.parse import urlparse

    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "redis",
        port=parsed.port or 6379,
        database=int((parsed.path or "/0").lstrip("/") or 0),
    )


class WorkerSettings:
    functions = [send_due_emails, run_signal_scrapers]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = _redis_settings_from_url(settings.redis_url)
    cron_jobs = [
        # Email sender — once per minute (default: minute=None, second=0)
        cron(send_due_emails, run_at_startup=True),
        # Signal scrapers — every 15 minutes
        cron(run_signal_scrapers, minute={0, 15, 30, 45}, run_at_startup=True),
    ]
