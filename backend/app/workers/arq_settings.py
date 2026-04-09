from arq.connections import RedisSettings

from app.config import settings


async def startup(ctx: dict) -> None:
    pass


async def shutdown(ctx: dict) -> None:
    pass


def _redis_settings_from_url(url: str) -> RedisSettings:
    # arq's RedisSettings expects host/port/database separately.
    # Parse a simple redis://host:port/db URL.
    from urllib.parse import urlparse

    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "redis",
        port=parsed.port or 6379,
        database=int((parsed.path or "/0").lstrip("/") or 0),
    )


class WorkerSettings:
    functions: list = []  # task functions registered here later
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = _redis_settings_from_url(settings.redis_url)
