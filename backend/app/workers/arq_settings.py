from arq import cron
from arq.connections import RedisSettings

from app.config import settings
from app.workers.email_tasks import send_due_emails


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
    functions = [send_due_emails]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = _redis_settings_from_url(settings.redis_url)
    # Run the email sender once a minute (at second :00 of every minute)
    cron_jobs = [cron(send_due_emails, run_at_startup=True)]
