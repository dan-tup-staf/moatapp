import logging

from app.services.signals import run_all_enabled_sources

logger = logging.getLogger(__name__)


async def run_signal_scrapers(ctx: dict) -> dict:
    """ARQ task — runs all enabled signal sources, persists new signals,
    auto-links to leads by email domain."""
    count = await run_all_enabled_sources()
    if count > 0:
        logger.info("run_signal_scrapers: ingested %d new signals", count)
    return {"new_signals": count}
