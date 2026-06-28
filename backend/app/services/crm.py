"""Cross-list CRM aggregations — used by the /lists page tabs (Firmy, Osoby).

Note: the existing services/leads.py is scoped to per-list operations
(create/update/delete a lead in a specific list). This module handles
user-scoped views that span all the user's lists."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.lead import Lead
from app.models.lead_list import LeadList
from app.models.message import Message
from app.models.signal import Signal
from app.models.signal_source import SignalSource

# Order: we pick the most meaningful status per company. A company with one
# replied lead is more interesting than one with all-new leads.
_STATUS_RANK = {
    "replied": 5,
    "contacted": 4,
    "new": 3,
    "bounced": 2,
    "unsubscribed": 1,
}


async def list_companies_for_user(
    db: AsyncSession, user_id: int
) -> list[dict]:
    """Aggregate per Lead.company value across the user's lists. Skips leads
    with NULL/empty company (they'll only show in Osoby tab). For each
    distinct company computes: leads_count, total_score, highest_status,
    signals_count (by matching company name), active enrollments, last
    message sent timestamp."""
    # Primary aggregation: Lead rows grouped by company
    leads_stmt = (
        select(
            Lead.company.label("company"),
            func.count(Lead.id).label("leads_count"),
            func.coalesce(func.sum(Lead.score), 0).label("total_score"),
            func.array_agg(Lead.status).label("statuses"),
            func.array_agg(Lead.id).label("lead_ids"),
        )
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(
            LeadList.user_id == user_id,
            Lead.company.isnot(None),
            Lead.company != "",
        )
        .group_by(Lead.company)
        .order_by(func.sum(Lead.score).desc(), func.count(Lead.id).desc())
    )
    leads_result = await db.execute(leads_stmt)
    leads_rows = leads_result.all()

    if not leads_rows:
        return []

    all_lead_ids = [
        lid for row in leads_rows for lid in (row.lead_ids or [])
    ]

    # Per-lead signal counts (joined via SignalSource ownership)
    sig_stmt = (
        select(Signal.lead_id, func.count(Signal.id).label("c"))
        .join(SignalSource, SignalSource.id == Signal.source_id)
        .where(
            SignalSource.user_id == user_id,
            Signal.lead_id.in_(all_lead_ids),
        )
        .group_by(Signal.lead_id)
    )
    sig_result = await db.execute(sig_stmt)
    signals_per_lead = {row[0]: row[1] for row in sig_result.all()}

    # Per-lead active enrollment counts
    enr_stmt = (
        select(
            CampaignEnrollment.lead_id, func.count(CampaignEnrollment.id).label("c")
        )
        .join(Campaign, Campaign.id == CampaignEnrollment.campaign_id)
        .where(
            Campaign.user_id == user_id,
            CampaignEnrollment.lead_id.in_(all_lead_ids),
            CampaignEnrollment.status == "active",
        )
        .group_by(CampaignEnrollment.lead_id)
    )
    enr_result = await db.execute(enr_stmt)
    enrolls_per_lead = {row[0]: row[1] for row in enr_result.all()}

    # Per-lead most recent sent message
    msg_stmt = (
        select(
            CampaignEnrollment.lead_id,
            func.max(Message.sent_at).label("last_sent_at"),
        )
        .join(
            CampaignEnrollment,
            CampaignEnrollment.id == Message.enrollment_id,
        )
        .join(Campaign, Campaign.id == CampaignEnrollment.campaign_id)
        .where(
            Campaign.user_id == user_id,
            CampaignEnrollment.lead_id.in_(all_lead_ids),
            Message.status == "sent",
            Message.sent_at.isnot(None),
        )
        .group_by(CampaignEnrollment.lead_id)
    )
    msg_result = await db.execute(msg_stmt)
    last_msg_per_lead = {row[0]: row[1] for row in msg_result.all()}

    # Combine
    out: list[dict] = []
    for row in leads_rows:
        lead_ids = row.lead_ids or []
        statuses = row.statuses or []
        highest = max(
            statuses, key=lambda s: _STATUS_RANK.get(s, 0), default="new"
        )
        signals_count = sum(signals_per_lead.get(lid, 0) for lid in lead_ids)
        active_enrollments = sum(
            enrolls_per_lead.get(lid, 0) for lid in lead_ids
        )
        last_sent = max(
            (
                last_msg_per_lead[lid]
                for lid in lead_ids
                if lid in last_msg_per_lead
            ),
            default=None,
        )
        out.append(
            {
                "company": row.company,
                "leads_count": row.leads_count,
                "total_score": int(row.total_score or 0),
                "highest_status": highest,
                "signals_count": signals_count,
                "active_enrollments": active_enrollments,
                "last_message_sent_at": last_sent,
            }
        )
    return out


async def count_people_for_user(
    db: AsyncSession, user_id: int, q: str | None = None
) -> int:
    stmt = (
        select(func.count(Lead.id))
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(LeadList.user_id == user_id)
    )
    stmt = _apply_people_search(stmt, q)
    return int((await db.execute(stmt)).scalar_one() or 0)


def _apply_people_search(stmt, q: str | None):
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            func.coalesce(Lead.email, "").ilike(like)
            | func.coalesce(Lead.first_name, "").ilike(like)
            | func.coalesce(Lead.last_name, "").ilike(like)
            | func.coalesce(Lead.company, "").ilike(like)
            | func.coalesce(Lead.title, "").ilike(like)
        )
    return stmt


async def list_people_for_user(
    db: AsyncSession,
    user_id: int,
    limit: int = 200,
    offset: int = 0,
    q: str | None = None,
) -> list[dict]:
    """Paginated list of leads across the user's lists, with denormalized
    list_name, signals_count per lead, and last_message_sent_at. Paginating
    server-side keeps the Osoby tab fast even with thousands of leads (a single
    huge payload was timing out on the hosting free tier)."""
    # Page of lead ids first (cheap), then enrich just that page.
    page_stmt = (
        select(Lead.id)
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(LeadList.user_id == user_id)
    )
    page_stmt = _apply_people_search(page_stmt, q)
    page_stmt = (
        page_stmt.order_by(Lead.score.desc(), Lead.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    page_ids = [r[0] for r in (await db.execute(page_stmt)).all()]
    if not page_ids:
        return []

    # Subquery: signal count per lead
    signals_sq = (
        select(Signal.lead_id, func.count(Signal.id).label("c"))
        .join(SignalSource, SignalSource.id == Signal.source_id)
        .where(SignalSource.user_id == user_id)
        .group_by(Signal.lead_id)
        .subquery()
    )

    # Subquery: last sent message per lead (via enrollment)
    last_msg_sq = (
        select(
            CampaignEnrollment.lead_id.label("lead_id"),
            func.max(Message.sent_at).label("last_sent_at"),
        )
        .join(
            CampaignEnrollment,
            CampaignEnrollment.id == Message.enrollment_id,
        )
        .join(Campaign, Campaign.id == CampaignEnrollment.campaign_id)
        .where(
            Campaign.user_id == user_id,
            Message.status == "sent",
            Message.sent_at.isnot(None),
        )
        .group_by(CampaignEnrollment.lead_id)
        .subquery()
    )

    stmt = (
        select(
            Lead,
            LeadList.name.label("list_name"),
            func.coalesce(signals_sq.c.c, 0).label("signals_count"),
            last_msg_sq.c.last_sent_at,
        )
        .join(LeadList, LeadList.id == Lead.list_id)
        .outerjoin(signals_sq, signals_sq.c.lead_id == Lead.id)
        .outerjoin(last_msg_sq, last_msg_sq.c.lead_id == Lead.id)
        .where(Lead.id.in_(page_ids))
        .order_by(Lead.score.desc(), Lead.created_at.desc())
    )
    result = await db.execute(stmt)
    out: list[dict] = []
    for lead, list_name, signals_count, last_sent_at in result.all():
        out.append(
            {
                "id": lead.id,
                "email": lead.email,
                "first_name": lead.first_name,
                "last_name": lead.last_name,
                "company": lead.company,
                "title": lead.title,
                "status": lead.status,
                "score": lead.score,
                "list_id": lead.list_id,
                "list_name": list_name,
                "signals_count": int(signals_count),
                "last_message_sent_at": last_sent_at,
                "created_at": lead.created_at,
            }
        )
    return out
