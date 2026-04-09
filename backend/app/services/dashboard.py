from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.lead import Lead
from app.models.lead_list import LeadList
from app.models.message import Message
from app.models.signal import Signal
from app.models.signal_source import SignalSource


async def _scalar(db: AsyncSession, stmt) -> int:
    result = await db.execute(stmt)
    return int(result.scalar_one() or 0)


async def get_stats(db: AsyncSession, user_id: int) -> dict:
    """Aggregate counters scoped to one user. Each metric is its own query —
    fast enough for MVP, easy to read."""
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    leads_total = await _scalar(
        db,
        select(func.count(Lead.id))
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(LeadList.user_id == user_id),
    )

    leads_contacted = await _scalar(
        db,
        select(func.count(Lead.id))
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(LeadList.user_id == user_id, Lead.status == "contacted"),
    )

    campaigns_total = await _scalar(
        db, select(func.count(Campaign.id)).where(Campaign.user_id == user_id)
    )

    campaigns_active = await _scalar(
        db,
        select(func.count(Campaign.id)).where(
            Campaign.user_id == user_id, Campaign.status == "active"
        ),
    )

    messages_sent_total = await _scalar(
        db,
        select(func.count(Message.id))
        .join(CampaignEnrollment, CampaignEnrollment.id == Message.enrollment_id)
        .join(Campaign, Campaign.id == CampaignEnrollment.campaign_id)
        .where(
            Campaign.user_id == user_id,
            Message.status == "sent",
            Message.sent_at.isnot(None),
        ),
    )

    messages_sent_last_7d = await _scalar(
        db,
        select(func.count(Message.id))
        .join(CampaignEnrollment, CampaignEnrollment.id == Message.enrollment_id)
        .join(Campaign, Campaign.id == CampaignEnrollment.campaign_id)
        .where(
            Campaign.user_id == user_id,
            Message.status == "sent",
            Message.sent_at >= seven_days_ago,
        ),
    )

    signals_total = await _scalar(
        db,
        select(func.count(Signal.id))
        .join(SignalSource, SignalSource.id == Signal.source_id)
        .where(SignalSource.user_id == user_id),
    )

    signals_last_7d = await _scalar(
        db,
        select(func.count(Signal.id))
        .join(SignalSource, SignalSource.id == Signal.source_id)
        .where(
            SignalSource.user_id == user_id,
            Signal.detected_at >= seven_days_ago,
        ),
    )

    active_enrollments = await _scalar(
        db,
        select(func.count(CampaignEnrollment.id))
        .join(Campaign, Campaign.id == CampaignEnrollment.campaign_id)
        .where(
            Campaign.user_id == user_id,
            CampaignEnrollment.status == "active",
        ),
    )

    return {
        "leads_total": leads_total,
        "leads_contacted": leads_contacted,
        "campaigns_total": campaigns_total,
        "campaigns_active": campaigns_active,
        "messages_sent_total": messages_sent_total,
        "messages_sent_last_7d": messages_sent_last_7d,
        "signals_total": signals_total,
        "signals_last_7d": signals_last_7d,
        "active_enrollments": active_enrollments,
    }


async def get_hot_leads(
    db: AsyncSession, user_id: int, limit: int = 10
) -> list[tuple[Lead, str, int]]:
    """Top N user-owned leads by score (desc) with denormalized list name and
    per-lead signal count. Skips leads with score == 0."""
    signals_sq = (
        select(Signal.lead_id, func.count(Signal.id).label("c"))
        .group_by(Signal.lead_id)
        .subquery()
    )
    stmt = (
        select(Lead, LeadList.name, func.coalesce(signals_sq.c.c, 0))
        .join(LeadList, LeadList.id == Lead.list_id)
        .outerjoin(signals_sq, signals_sq.c.lead_id == Lead.id)
        .where(LeadList.user_id == user_id, Lead.score > 0)
        .order_by(Lead.score.desc(), Lead.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [(row[0], row[1], row[2]) for row in result.all()]
