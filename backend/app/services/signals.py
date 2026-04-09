import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models.lead import Lead
from app.models.lead_list import LeadList
from app.models.signal import Signal
from app.models.signal_source import SignalSource
from app.scrapers import SCRAPERS
from app.schemas.signals import SignalSourceCreate, SignalSourceUpdate

logger = logging.getLogger(__name__)


# ---------- SignalSource CRUD ----------


async def create_source(
    db: AsyncSession, user_id: int, payload: SignalSourceCreate
) -> SignalSource:
    obj = SignalSource(
        user_id=user_id,
        name=payload.name,
        type=payload.type.value if hasattr(payload.type, "value") else payload.type,
        config=payload.config,
        enabled=payload.enabled,
        score_weight=payload.score_weight,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def list_sources_with_counts(
    db: AsyncSession, user_id: int
) -> list[tuple[SignalSource, int]]:
    counts_sq = (
        select(Signal.source_id, func.count(Signal.id).label("c"))
        .group_by(Signal.source_id)
        .subquery()
    )
    stmt = (
        select(SignalSource, func.coalesce(counts_sq.c.c, 0))
        .outerjoin(counts_sq, counts_sq.c.source_id == SignalSource.id)
        .where(SignalSource.user_id == user_id)
        .order_by(SignalSource.created_at.desc())
    )
    result = await db.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]


async def get_source(
    db: AsyncSession, user_id: int, source_id: int
) -> SignalSource | None:
    stmt = select(SignalSource).where(
        SignalSource.id == source_id, SignalSource.user_id == user_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_source(
    db: AsyncSession, source: SignalSource, payload: SignalSourceUpdate
) -> SignalSource:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(source, k, v)
    await db.commit()
    await db.refresh(source)
    return source


async def delete_source(db: AsyncSession, source: SignalSource) -> None:
    await db.delete(source)
    await db.commit()


async def count_signals(db: AsyncSession, source_id: int) -> int:
    result = await db.execute(
        select(func.count(Signal.id)).where(Signal.source_id == source_id)
    )
    return result.scalar_one()


# ---------- Signal feed ----------


async def list_signals_for_user(
    db: AsyncSession, user_id: int, limit: int = 100
) -> list[tuple[Signal, SignalSource, Lead | None]]:
    """Returns recent signals for the user (joined with source + optional lead)."""
    stmt = (
        select(Signal, SignalSource, Lead)
        .join(SignalSource, SignalSource.id == Signal.source_id)
        .outerjoin(Lead, Lead.id == Signal.lead_id)
        .where(SignalSource.user_id == user_id)
        .order_by(Signal.detected_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [(row[0], row[1], row[2]) for row in result.all()]


async def get_signal(
    db: AsyncSession, user_id: int, signal_id: int
) -> Signal | None:
    stmt = (
        select(Signal)
        .join(SignalSource, SignalSource.id == Signal.source_id)
        .where(Signal.id == signal_id, SignalSource.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_signal(db: AsyncSession, signal: Signal) -> None:
    await db.delete(signal)
    await db.commit()


# ---------- Lead linking ----------


async def _link_signal_to_lead(
    db: AsyncSession, signal: Signal, source_user_id: int
) -> Lead | None:
    """Find the first lead in the user's lists whose email domain matches
    the signal's company_domain. If found, link them and bump score."""
    if not signal.company_domain:
        return None
    domain = signal.company_domain.lower().strip()
    if not domain:
        return None

    stmt = (
        select(Lead)
        .join(LeadList, Lead.list_id == LeadList.id)
        .where(
            func.lower(func.split_part(Lead.email, "@", 2)) == domain,
            LeadList.user_id == source_user_id,
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    lead = result.scalar_one_or_none()
    if lead is None:
        return None

    signal.lead_id = lead.id
    lead.score = (lead.score or 0) + signal.score_weight
    await db.commit()
    return lead


# ---------- Source runner ----------


async def run_source(db: AsyncSession, source: SignalSource) -> int:
    """Run a single source: scrape, dedup-insert signals, link each to a lead.
    Updates source.last_run_at / last_error. Returns count of NEW signals.

    NOTE: we capture source attributes as locals up-front because per-row
    commit/rollback in the insert loop expires the source ORM object, which
    would cause MissingGreenlet on later attribute access. We re-fetch it at
    the end to update last_run_at / last_error."""
    source_id = source.id
    source_user_id = source.user_id
    source_type = source.type
    source_config = dict(source.config or {})
    source_score_weight = source.score_weight

    scraper = SCRAPERS.get(source_type)
    if scraper is None:
        await _finalize_source(
            db, source_id, error=f"Unknown scraper type: {source_type}"
        )
        return 0

    try:
        scraped = await scraper.fetch(source_config)
    except Exception as e:
        logger.exception("Scraper %s failed", source_id)
        await _finalize_source(db, source_id, error=str(e)[:1000])
        return 0

    new_count = 0
    for s in scraped:
        signal = Signal(
            source_id=source_id,
            company_domain=s.company_domain,
            title=s.title[:512],
            url=s.url,
            payload=s.payload or {},
            score_weight=source_score_weight,
        )
        db.add(signal)
        try:
            await db.commit()
            await db.refresh(signal)
        except IntegrityError:
            # Duplicate (source_id, url) — already seen
            await db.rollback()
            continue

        new_count += 1
        try:
            await _link_signal_to_lead(db, signal, source_user_id)
        except Exception:
            logger.exception("Failed to link signal %s to lead", signal.id)
            await db.rollback()

    await _finalize_source(db, source_id, error=None)
    return new_count


async def _finalize_source(
    db: AsyncSession, source_id: int, error: str | None
) -> None:
    """Re-fetch source by id and update last_run_at / last_error. Used after
    loops that may have rolled back the session and expired the original ORM
    object."""
    fresh = (
        await db.execute(select(SignalSource).where(SignalSource.id == source_id))
    ).scalar_one_or_none()
    if fresh is None:
        return
    fresh.last_run_at = datetime.now(timezone.utc)
    fresh.last_error = error
    await db.commit()


async def run_all_enabled_sources() -> int:
    """Worker entry point — fetch all enabled sources and run each in its own
    session to isolate failures. Returns total NEW signals across all sources."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SignalSource.id).where(SignalSource.enabled.is_(True))
        )
        source_ids = [row[0] for row in result.all()]

    total = 0
    for sid in source_ids:
        async with AsyncSessionLocal() as db:
            fresh = (
                await db.execute(
                    select(SignalSource).where(SignalSource.id == sid)
                )
            ).scalar_one_or_none()
            if fresh is None:
                continue
            try:
                total += await run_source(db, fresh)
            except Exception:
                logger.exception("Failed to run source %s", sid)
                continue
    return total
