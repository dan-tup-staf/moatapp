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


def _rate(num: int, den: int) -> float:
    return round(100 * num / den, 1) if den else 0.0


async def get_results(db: AsyncSession, user_id: int) -> dict:
    """Per-sequence engagement results: sent / open / click / reply / bounce
    with rates, plus account-wide totals. Message-level for sent/open/click,
    prospect-level (enrollment status) for reply/bounce."""
    from sqlalchemy import case

    # Message aggregates per campaign (join via enrollment so deleted steps
    # don't drop rows).
    msg_rows = (
        await db.execute(
            select(
                Campaign.id,
                func.coalesce(
                    func.sum(case((Message.status == "sent", 1), else_=0)), 0
                ),
                func.coalesce(
                    func.sum(
                        case((Message.opened_at.isnot(None), 1), else_=0)
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(
                        case((Message.clicked_at.isnot(None), 1), else_=0)
                    ),
                    0,
                ),
            )
            .select_from(Campaign)
            .outerjoin(
                CampaignEnrollment,
                CampaignEnrollment.campaign_id == Campaign.id,
            )
            .outerjoin(
                Message, Message.enrollment_id == CampaignEnrollment.id
            )
            .where(Campaign.user_id == user_id)
            .group_by(Campaign.id)
        )
    ).all()
    msg_by_campaign = {r[0]: (int(r[1]), int(r[2]), int(r[3])) for r in msg_rows}

    # Enrollment aggregates per campaign.
    enr_rows = (
        await db.execute(
            select(
                Campaign.id,
                Campaign.name,
                Campaign.status,
                func.count(CampaignEnrollment.id),
                func.coalesce(
                    func.sum(
                        case((CampaignEnrollment.current_step > 0, 1), else_=0)
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(
                        case(
                            (CampaignEnrollment.status == "replied", 1),
                            else_=0,
                        )
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(
                        case(
                            (CampaignEnrollment.status == "bounced", 1),
                            else_=0,
                        )
                    ),
                    0,
                ),
            )
            .select_from(Campaign)
            .outerjoin(
                CampaignEnrollment,
                CampaignEnrollment.campaign_id == Campaign.id,
            )
            .where(Campaign.user_id == user_id)
            .group_by(Campaign.id, Campaign.name, Campaign.status)
            .order_by(Campaign.created_at.desc())
        )
    ).all()

    campaigns: list[dict] = []
    t_sent = t_open = t_click = t_reply = t_bounce = t_enrolled = 0
    for cid, name, status, enrolled, contacted, replied, bounced in enr_rows:
        sent, opened, clicked = msg_by_campaign.get(cid, (0, 0, 0))
        enrolled = int(enrolled)
        replied = int(replied)
        bounced = int(bounced)
        campaigns.append(
            {
                "campaign_id": cid,
                "name": name,
                "status": status,
                "enrolled": enrolled,
                "sent": sent,
                "opened": opened,
                "clicked": clicked,
                "replied": replied,
                "bounced": bounced,
                "open_rate": _rate(opened, sent),
                "click_rate": _rate(clicked, sent),
                "reply_rate": _rate(replied, enrolled),
            }
        )
        t_sent += sent
        t_open += opened
        t_click += clicked
        t_reply += replied
        t_bounce += bounced
        t_enrolled += enrolled

    return {
        "totals": {
            "enrolled": t_enrolled,
            "sent": t_sent,
            "opened": t_open,
            "clicked": t_click,
            "replied": t_reply,
            "bounced": t_bounce,
            "open_rate": _rate(t_open, t_sent),
            "click_rate": _rate(t_click, t_sent),
            "reply_rate": _rate(t_reply, t_enrolled),
        },
        "campaigns": campaigns,
    }


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
