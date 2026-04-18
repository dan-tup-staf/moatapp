from datetime import datetime, timezone

from sqlalchemy import case, func, select
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
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


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
    for lid in lead_ids:
        obj = CampaignEnrollment(
            campaign_id=campaign_id,
            lead_id=lid,
            current_step=0,
            next_send_at=now,
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
    }


def render_template(template: str, lead: Lead) -> str:
    """Simple {{var}} substitution for prospecting templates. Unknown variables
    are left as-is so users can spot mistakes in preview."""
    variables = {
        "first_name": lead.first_name or "",
        "last_name": lead.last_name or "",
        "company": lead.company or "",
        "title": lead.title or "",
        "email": lead.email,
    }
    result = template
    for k, v in variables.items():
        result = result.replace("{{" + k + "}}", v)
    return result
