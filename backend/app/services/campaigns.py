import hashlib
import re
from datetime import datetime, timezone

from sqlalchemy import case, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.lead import Lead
from app.models.lead_list import LeadList
from app.models.message import Message
from app.models.sequence_step import SequenceStep
from app.schemas.campaigns import (
    CampaignCreate,
    CampaignUpdate,
    EnrollResult,
    StepCreate,
    StepUpdate,
)

# ---------- Campaigns ----------


async def create_campaign(
    db: AsyncSession, user_id: int, payload: CampaignCreate
) -> Campaign:
    obj = Campaign(
        user_id=user_id,
        name=payload.name,
        from_email=payload.from_email,
        from_name=payload.from_name,
        scheduled_at=payload.scheduled_at,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


def _normalize_aware(dt: datetime | None) -> datetime | None:
    """Treat naive datetimes (e.g. from older rows) as UTC for safe compares."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def _initial_send_at(
    db: AsyncSession, campaign_id: int, now: datetime
) -> datetime:
    """First-step send time for a new enrollment: the campaign's scheduled_at
    if it lies in the future, otherwise now (send asap)."""
    res = await db.execute(
        select(Campaign.scheduled_at).where(Campaign.id == campaign_id)
    )
    sched = _normalize_aware(res.scalar_one_or_none())
    if sched is not None and sched > now:
        return sched
    return now


async def apply_scheduled_start(db: AsyncSession, campaign: Campaign) -> None:
    """If the campaign has a future scheduled_at, align step-0 active
    enrollments to fire then (so changing the schedule after enrolling works)."""
    sched = _normalize_aware(campaign.scheduled_at)
    if sched is None or sched <= datetime.now(timezone.utc):
        return
    await db.execute(
        update(CampaignEnrollment)
        .where(
            CampaignEnrollment.campaign_id == campaign.id,
            CampaignEnrollment.current_step == 0,
            CampaignEnrollment.status == "active",
        )
        .values(next_send_at=sched)
    )
    await db.commit()


async def list_campaigns_with_counts(
    db: AsyncSession, user_id: int
) -> list[tuple[Campaign, int, int]]:
    """Returns (Campaign, steps_count, enrollments_count) tuples."""
    # Two subqueries to avoid Cartesian explosion when counting both
    steps_sq = (
        select(SequenceStep.campaign_id, func.count(SequenceStep.id).label("c"))
        .group_by(SequenceStep.campaign_id)
        .subquery()
    )
    enr_sq = (
        select(
            CampaignEnrollment.campaign_id,
            func.count(CampaignEnrollment.id).label("c"),
        )
        .group_by(CampaignEnrollment.campaign_id)
        .subquery()
    )
    stmt = (
        select(
            Campaign,
            func.coalesce(steps_sq.c.c, 0),
            func.coalesce(enr_sq.c.c, 0),
        )
        .outerjoin(steps_sq, steps_sq.c.campaign_id == Campaign.id)
        .outerjoin(enr_sq, enr_sq.c.campaign_id == Campaign.id)
        .where(Campaign.user_id == user_id)
        .order_by(Campaign.created_at.desc())
    )
    result = await db.execute(stmt)
    return [(row[0], row[1], row[2]) for row in result.all()]


async def get_campaign(
    db: AsyncSession, user_id: int, campaign_id: int
) -> Campaign | None:
    stmt = select(Campaign).where(
        Campaign.id == campaign_id, Campaign.user_id == user_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def count_steps(db: AsyncSession, campaign_id: int) -> int:
    result = await db.execute(
        select(func.count(SequenceStep.id)).where(
            SequenceStep.campaign_id == campaign_id
        )
    )
    return result.scalar_one()


async def count_enrollments(db: AsyncSession, campaign_id: int) -> int:
    result = await db.execute(
        select(func.count(CampaignEnrollment.id)).where(
            CampaignEnrollment.campaign_id == campaign_id
        )
    )
    return result.scalar_one()


async def update_campaign(
    db: AsyncSession, campaign: Campaign, payload: CampaignUpdate
) -> Campaign:
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and hasattr(data["status"], "value"):
        data["status"] = data["status"].value
    for k, v in data.items():
        setattr(campaign, k, v)
    await db.commit()
    await db.refresh(campaign)
    # Keep already-enrolled step-0 leads aligned with the (possibly new) schedule.
    await apply_scheduled_start(db, campaign)
    await db.refresh(campaign)
    return campaign


async def delete_campaign(db: AsyncSession, campaign: Campaign) -> None:
    await db.delete(campaign)
    await db.commit()


# ---------- Steps ----------


async def list_steps(db: AsyncSession, campaign_id: int) -> list[SequenceStep]:
    stmt = (
        select(SequenceStep)
        .where(SequenceStep.campaign_id == campaign_id)
        .order_by(SequenceStep.step_order.asc(), SequenceStep.id.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_step(
    db: AsyncSession, campaign_id: int, payload: StepCreate
) -> SequenceStep:
    obj = SequenceStep(campaign_id=campaign_id, **payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_step(
    db: AsyncSession, campaign_id: int, step_id: int
) -> SequenceStep | None:
    stmt = select(SequenceStep).where(
        SequenceStep.id == step_id, SequenceStep.campaign_id == campaign_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_step(
    db: AsyncSession, step: SequenceStep, payload: StepUpdate
) -> SequenceStep:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(step, k, v)
    await db.commit()
    await db.refresh(step)
    return step


async def delete_step(db: AsyncSession, step: SequenceStep) -> None:
    await db.delete(step)
    await db.commit()


# ---------- Enrollments ----------


def _tier_for_score(score: int) -> int:
    if score > 100:
        return 1
    if score > 20:
        return 2
    return 3


def _compute_source_strength(
    signals_count: int,
    linked_signals_count: int,
    pipeline_impact: int,
    latest_signal_at,
) -> int:
    """Mirror of frontend computeStrength — returns 0-5 based on freshness,
    hit-rate and cumulative score impact. Kept in sync manually for now."""
    from datetime import datetime, timezone

    if signals_count == 0:
        return 0

    if latest_signal_at is None:
        fresh = 1
    else:
        days = (
            datetime.now(timezone.utc) - latest_signal_at
        ).total_seconds() / 86400
        if days < 1:
            fresh = 5
        elif days < 7:
            fresh = 4
        elif days < 30:
            fresh = 3
        elif days < 90:
            fresh = 2
        else:
            fresh = 1

    hit_rate = linked_signals_count / signals_count
    if hit_rate > 0.5:
        hit = 5
    elif hit_rate > 0.3:
        hit = 4
    elif hit_rate > 0.15:
        hit = 3
    elif hit_rate > 0.05:
        hit = 2
    else:
        hit = 1

    if pipeline_impact > 500:
        impact = 5
    elif pipeline_impact > 100:
        impact = 4
    elif pipeline_impact > 50:
        impact = 3
    elif pipeline_impact > 10:
        impact = 2
    else:
        impact = 1

    return round((fresh + hit + impact) / 3)


async def audience_preview(
    db: AsyncSession, user_id: int, campaign_id: int, criteria
) -> dict:
    """Returns leads matching the audience criteria, with already_enrolled hint."""
    from app.models.signal import Signal
    from app.models.signal_source import SignalSource
    from app.services.signals import list_summaries_for_user

    # 1. Resolve source_ids passing min_source_strength filter
    allowed_source_ids: set[int] | None = None
    if criteria.min_source_strength is not None:
        summaries = await list_summaries_for_user(db, user_id)
        allowed_source_ids = set()
        for s in summaries:
            strength = _compute_source_strength(
                s["signals_count"],
                s["linked_signals_count"],
                s["pipeline_impact"],
                s["latest_signal_at"],
            )
            if strength >= criteria.min_source_strength:
                allowed_source_ids.add(s["source_id"])

    # Union with explicit signal_source_ids (OR semantics for source-based filters)
    effective_source_ids: set[int] | None = None
    if criteria.signal_source_ids:
        explicit = set(criteria.signal_source_ids)
        if allowed_source_ids is not None:
            effective_source_ids = explicit | allowed_source_ids
        else:
            effective_source_ids = explicit
    elif allowed_source_ids is not None:
        effective_source_ids = allowed_source_ids

    # 2. Build base query of user's leads
    stmt = (
        select(Lead, LeadList.name)
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(LeadList.user_id == user_id)
    )

    if criteria.include_list_ids:
        stmt = stmt.where(Lead.list_id.in_(criteria.include_list_ids))

    if criteria.exclude_list_ids:
        stmt = stmt.where(~Lead.list_id.in_(criteria.exclude_list_ids))

    # Tier filter = score range
    if criteria.tiers:
        tier_conds = []
        if 1 in criteria.tiers:
            tier_conds.append(Lead.score > 100)
        if 2 in criteria.tiers:
            tier_conds.append((Lead.score > 20) & (Lead.score <= 100))
        if 3 in criteria.tiers:
            tier_conds.append(Lead.score <= 20)
        if tier_conds:
            from sqlalchemy import or_

            stmt = stmt.where(or_(*tier_conds))

    # Signal-based filters (EXISTS subquery)
    if (
        effective_source_ids is not None
        or criteria.signal_title_query
    ):
        sig_subq = select(Signal.lead_id).where(
            Signal.lead_id == Lead.id
        )
        if effective_source_ids is not None:
            sig_subq = sig_subq.where(
                Signal.source_id.in_(effective_source_ids)
            )
        if criteria.signal_title_query:
            q = f"%{criteria.signal_title_query.strip()}%"
            sig_subq = sig_subq.where(Signal.title.ilike(q))
        # Also scope signals to user's sources
        sig_subq = sig_subq.join(
            SignalSource, SignalSource.id == Signal.source_id
        ).where(SignalSource.user_id == user_id)
        stmt = stmt.where(sig_subq.exists())

    stmt = stmt.order_by(Lead.score.desc(), Lead.created_at.desc())
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        return {
            "leads": [],
            "matched_total": 0,
            "already_enrolled_count": 0,
        }

    lead_ids = [r[0].id for r in rows]

    # Already enrolled lookup
    enr_stmt = select(CampaignEnrollment.lead_id).where(
        CampaignEnrollment.campaign_id == campaign_id,
        CampaignEnrollment.lead_id.in_(lead_ids),
    )
    enrolled_ids = {
        row[0] for row in (await db.execute(enr_stmt)).all()
    }

    # Per-lead signal counts (scoped to user)
    sig_counts_stmt = (
        select(Signal.lead_id, func.count(Signal.id))
        .join(SignalSource, SignalSource.id == Signal.source_id)
        .where(
            SignalSource.user_id == user_id,
            Signal.lead_id.in_(lead_ids),
        )
        .group_by(Signal.lead_id)
    )
    sig_counts = {
        row[0]: row[1] for row in (await db.execute(sig_counts_stmt)).all()
    }

    leads_out = []
    for lead, list_name in rows:
        leads_out.append(
            {
                "id": lead.id,
                "email": lead.email,
                "first_name": lead.first_name,
                "last_name": lead.last_name,
                "company": lead.company,
                "title": lead.title,
                "score": lead.score,
                "tier": _tier_for_score(lead.score),
                "list_id": lead.list_id,
                "list_name": list_name,
                "signals_count": sig_counts.get(lead.id, 0),
                "already_enrolled": lead.id in enrolled_ids,
            }
        )

    return {
        "leads": leads_out,
        "matched_total": len(leads_out),
        "already_enrolled_count": len(enrolled_ids),
    }


async def enroll_leads(
    db: AsyncSession,
    user_id: int,
    campaign_id: int,
    lead_ids: list[int],
) -> EnrollResult:
    """Enroll specific lead_ids (verified to belong to user). Skips
    duplicates via the UNIQUE constraint on (campaign_id, lead_id)."""
    # Verify ownership — only enroll leads that belong to a list owned by user
    verify_stmt = (
        select(Lead.id)
        .join(LeadList, LeadList.id == Lead.list_id)
        .where(LeadList.user_id == user_id, Lead.id.in_(lead_ids))
    )
    valid_ids = {row[0] for row in (await db.execute(verify_stmt)).all()}

    enrolled = 0
    skipped = 0
    now = datetime.now(timezone.utc)
    send_at = await _initial_send_at(db, campaign_id, now)
    for lid in valid_ids:
        obj = CampaignEnrollment(
            campaign_id=campaign_id,
            lead_id=lid,
            current_step=0,
            next_send_at=send_at,
            status="active",
        )
        db.add(obj)
        try:
            await db.commit()
            enrolled += 1
        except IntegrityError:
            await db.rollback()
            skipped += 1
    return EnrollResult(enrolled=enrolled, skipped_already_enrolled=skipped)


async def enroll_from_list(
    db: AsyncSession, user_id: int, campaign_id: int, list_id: int
) -> EnrollResult:
    """Enroll all leads from a user-owned list into the campaign. Skips leads
    that are already enrolled (UniqueConstraint on (campaign_id, lead_id))."""
    # Verify the list belongs to the user
    list_stmt = select(LeadList).where(
        LeadList.id == list_id, LeadList.user_id == user_id
    )
    list_result = await db.execute(list_stmt)
    lead_list = list_result.scalar_one_or_none()
    if lead_list is None:
        return EnrollResult(enrolled=0, skipped_already_enrolled=0)

    leads_stmt = select(Lead.id).where(Lead.list_id == list_id)
    leads_result = await db.execute(leads_stmt)
    lead_ids = [row[0] for row in leads_result.all()]

    enrolled = 0
    skipped = 0
    now = datetime.now(timezone.utc)
    send_at = await _initial_send_at(db, campaign_id, now)
    for lid in lead_ids:
        obj = CampaignEnrollment(
            campaign_id=campaign_id,
            lead_id=lid,
            current_step=0,
            next_send_at=send_at,
            status="active",
        )
        db.add(obj)
        try:
            await db.commit()
            enrolled += 1
        except IntegrityError:
            await db.rollback()
            skipped += 1

    return EnrollResult(enrolled=enrolled, skipped_already_enrolled=skipped)


async def list_enrollments(
    db: AsyncSession, campaign_id: int
) -> list[tuple[CampaignEnrollment, Lead]]:
    """Returns (enrollment, lead) tuples joined for display."""
    stmt = (
        select(CampaignEnrollment, Lead)
        .join(Lead, Lead.id == CampaignEnrollment.lead_id)
        .where(CampaignEnrollment.campaign_id == campaign_id)
        .order_by(CampaignEnrollment.created_at.desc())
    )
    result = await db.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]


async def get_enrollment(
    db: AsyncSession, campaign_id: int, enrollment_id: int
) -> CampaignEnrollment | None:
    stmt = select(CampaignEnrollment).where(
        CampaignEnrollment.id == enrollment_id,
        CampaignEnrollment.campaign_id == campaign_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_enrollment(
    db: AsyncSession, enrollment: CampaignEnrollment
) -> None:
    await db.delete(enrollment)
    await db.commit()


# ---------- Template rendering ----------


async def get_campaign_stats(
    db: AsyncSession, campaign_id: int
) -> dict:
    """Lemlist-style aggregated metrics for a campaign. Three queries:
    enrollment breakdown by status, overall message counts, per-step
    message counts."""
    # Enrollments by status
    enr_stmt = (
        select(CampaignEnrollment.status, func.count(CampaignEnrollment.id))
        .where(CampaignEnrollment.campaign_id == campaign_id)
        .group_by(CampaignEnrollment.status)
    )
    enr_counts = {row[0]: row[1] for row in (await db.execute(enr_stmt)).all()}
    total_enr = sum(enr_counts.values())

    # Overall message counts
    msg_stmt = (
        select(
            func.coalesce(
                func.sum(case((Message.status == "sent", 1), else_=0)), 0
            ),
            func.coalesce(
                func.sum(case((Message.status == "failed", 1), else_=0)), 0
            ),
        )
        .select_from(Message)
        .join(
            CampaignEnrollment,
            CampaignEnrollment.id == Message.enrollment_id,
        )
        .where(CampaignEnrollment.campaign_id == campaign_id)
    )
    msg_sent, msg_failed = (await db.execute(msg_stmt)).one()

    # Per-step counts — LEFT JOIN so steps with zero sends still appear
    step_stmt = (
        select(
            SequenceStep.id,
            SequenceStep.step_order,
            func.coalesce(
                func.sum(case((Message.status == "sent", 1), else_=0)), 0
            ),
            func.coalesce(
                func.sum(case((Message.status == "failed", 1), else_=0)), 0
            ),
        )
        .outerjoin(Message, Message.step_id == SequenceStep.id)
        .where(SequenceStep.campaign_id == campaign_id)
        .group_by(SequenceStep.id, SequenceStep.step_order)
        .order_by(SequenceStep.step_order.asc(), SequenceStep.id.asc())
    )
    step_rows = (await db.execute(step_stmt)).all()

    pipeline = await _campaign_pipeline_buckets(db, campaign_id)

    return {
        "enrollments": {
            "total": int(total_enr),
            "active": int(enr_counts.get("active", 0)),
            "completed": int(enr_counts.get("completed", 0)),
            "paused": int(enr_counts.get("paused", 0)),
            "replied": int(enr_counts.get("replied", 0)),
            "bounced": int(enr_counts.get("bounced", 0)),
        },
        "messages_sent_total": int(msg_sent or 0),
        "messages_failed_total": int(msg_failed or 0),
        "steps": [
            {
                "step_id": row[0],
                "step_order": row[1],
                "sent_count": int(row[2] or 0),
                "failed_count": int(row[3] or 0),
            }
            for row in step_rows
        ],
        "pipeline": pipeline,
    }


async def _campaign_pipeline_buckets(
    db: AsyncSession, campaign_id: int
) -> list[dict]:
    """Group this campaign's enrolled leads into 4 buying-journey stages
    (mirror of services/pipeline.py but scoped to one campaign)."""
    from app.models.lead import Lead as LeadModel

    stage_by_status = {
        "new": "awareness",
        "contacted": "education",
        "replied": "requirements",
    }
    stage_labels = {
        "awareness": "Świadomość",
        "education": "Edukacja",
        "requirements": "Budowanie wymagań",
        "vendor_selection": "Wybór dostawcy",
    }
    order = ["awareness", "education", "requirements", "vendor_selection"]

    # Per-company rollup: highest status + sum(score) across leads of enrollees
    stmt = (
        select(
            LeadModel.company,
            LeadModel.status,
            LeadModel.score,
        )
        .join(
            CampaignEnrollment,
            CampaignEnrollment.lead_id == LeadModel.id,
        )
        .where(
            CampaignEnrollment.campaign_id == campaign_id,
            LeadModel.company.isnot(None),
            LeadModel.company != "",
        )
    )
    rows = (await db.execute(stmt)).all()

    status_rank = {
        "replied": 5,
        "contacted": 4,
        "new": 3,
        "bounced": 2,
        "unsubscribed": 1,
    }

    per_company: dict[str, dict] = {}
    for company, lead_status, score in rows:
        entry = per_company.setdefault(
            company, {"status": lead_status, "score": 0}
        )
        if status_rank.get(lead_status, 0) > status_rank.get(
            entry["status"], 0
        ):
            entry["status"] = lead_status
        entry["score"] += int(score or 0)

    buckets: dict[str, list[dict]] = {s: [] for s in order}
    for company, data in per_company.items():
        stage = stage_by_status.get(data["status"])
        if stage is None:
            continue  # bounced/unsubscribed skipped
        tier = 1 if data["score"] > 100 else 2 if data["score"] > 20 else 3
        buckets[stage].append(
            {"company": company, "score": data["score"], "tier": tier}
        )

    result = []
    for s in order:
        arr = buckets[s]
        t1 = sum(1 for c in arr if c["tier"] == 1)
        t2 = sum(1 for c in arr if c["tier"] == 2)
        t3 = sum(1 for c in arr if c["tier"] == 3)
        result.append(
            {
                "stage": s,
                "name": stage_labels[s],
                "companies_count": len(arr),
                "total_score": sum(c["score"] for c in arr),
                "tier1": t1,
                "tier2": t2,
                "tier3": t3,
            }
        )
    return result


_SPIN_RE = re.compile(r"\{spin\s+(.*?)\s+endspin\}", re.IGNORECASE | re.DOTALL)


def _expand_spintax(template: str, seed: str) -> str:
    """Expand {spin A|B|C endspin} blocks. The chosen option is deterministic
    per recipient (seeded by their email + the block), so the same prospect
    always gets the same wording across previews/sends — important for threads."""

    def pick(m: "re.Match[str]") -> str:
        options = [o.strip() for o in m.group(1).split("|")]
        options = [o for o in options if o] or [""]
        digest = hashlib.md5(f"{seed}|{m.group(1)}".encode("utf-8")).hexdigest()
        return options[int(digest, 16) % len(options)]

    return _SPIN_RE.sub(pick, template)


def render_template(template: str, lead: Lead) -> str:
    """Render a prospecting template: expand {spin ...|... endspin} blocks, then
    do {{var}} substitution. Unknown variables are left as-is so users can spot
    mistakes in preview."""
    result = _expand_spintax(template, lead.email or "")
    variables = {
        "first_name": lead.first_name or "",
        "last_name": lead.last_name or "",
        "company": lead.company or "",
        "title": lead.title or "",
        "email": lead.email,
    }
    for k, v in variables.items():
        result = result.replace("{{" + k + "}}", v)
    return result
