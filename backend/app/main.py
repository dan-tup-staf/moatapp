import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.config import settings

logger = logging.getLogger(__name__)


async def _scheduler_loop() -> None:
    """In-process tick: send due campaign emails every interval, optionally run
    signal scrapers on a slower cadence. Crash-safe — never raises out of a tick.
    Note: on free hosting the service sleeps when idle, pausing this loop; use
    the /api/v1/tick endpoint from an external cron for guaranteed cadence."""
    from app.services.email_sender import process_due_enrollments
    from app.services.signals import run_all_enabled_sources

    interval = max(15, settings.scheduler_interval_seconds)
    signal_every = max(1, settings.signal_interval_seconds // interval)
    tick = 0
    logger.info("scheduler started (interval=%ss)", interval)
    while True:
        try:
            await process_due_enrollments()
        except Exception:
            logger.exception("scheduler: email tick failed")
        if settings.scheduler_run_signals and tick % signal_every == 0:
            try:
                await run_all_enabled_sources()
            except Exception:
                logger.exception("scheduler: signals tick failed")
        tick += 1
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task: asyncio.Task | None = None
    if settings.scheduler_enabled:
        task = asyncio.create_task(_scheduler_loop())
    yield
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def create_app() -> FastAPI:
    app = FastAPI(
        title="MOATION API",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Bearer-token auth means we don't rely on cookies, so wildcard CORS is
    # acceptable for hosted demos. allow_credentials must be False with "*".
    if settings.cors_allow_all:
        allow_origins = ["*"]
        allow_credentials = False
    else:
        allow_origins = settings.cors_origins
        allow_credentials = True

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
