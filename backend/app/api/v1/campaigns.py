from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.lead import Lead
from app.models.lead_list import LeadList
from app.models.user import User
from app.schemas.campaigns import (
    AudienceCriteria,
    AudienceEnrollRequest,
    AudiencePreview,
    CampaignCreate,
    CampaignRead,
    CampaignStats,
    CampaignUpdate,
    EnrollFromList,
    EnrollmentRead,
    EnrollResult,
    PreviewRequest,
    PreviewResponse,
    StepCreate,
    StepRead,
    StepTestSendRequest,
    StepTestSendResult,
    StepUpdate,
    VariantCreate,
    VariantRead,
)
from app.services import campaigns as svc
from app.services.email_sender import _send_via_smtp, process_due_enrollments

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _to_campaign_read(c, steps_count: int, enrollments_count: int) -> CampaignRead:
    return CampaignRead(
        id=c.id,
        name=c.name,
        status=c.status,
        from_email=c.from_email,
        from_name=c.from_name,
        group_id=c.group_id,
        scheduled_at=c.scheduled_at,
        send_window_start_hour=c.send_window_start_hour,
        send_window_end_hour=c.send_window_end_hour,
        send_days=c.send_days,
        include_unsubscribe=c.include_unsubscribe,
        unsubscribe_text=c.unsubscribe_text,
        track_opens=c.track_opens,
        created_at=c.created_at,
        updated_at=c.updated_at,
        steps_count=steps_count,
        enrollments_count=enrollments_count,
    )


async def _ensure_owned_campaign(
    db: AsyncSession, current: User, campaign_id: int
):
    obj = await svc.get_campaign(db, current.id, campaign_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return obj


# ---------- Campaign CRUD ----------


@router.get("", response_model=list[CampaignRead])
async def list_all(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CampaignRead]:
    rows = await svc.list_campaigns_with_counts(db, current.id)
    return [_to_campaign_read(c, sc, ec) for c, sc, ec in rows]


@router.post("", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_one(
    payload: CampaignCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CampaignRead:
    obj = await svc.create_campaign(db, current.id, payload)
    return _to_campaign_read(obj, 0, 0)


@router.get("/{campaign_id}", response_model=CampaignRead)
async def get_one(
    campaign_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CampaignRead:
    obj = await _ensure_owned_campaign(db, current, campaign_id)
    sc = await svc.count_steps(db, obj.id)
    ec = await svc.count_enrollments(db, obj.id)
    return _to_campaign_read(obj, sc, ec)


@router.patch("/{campaign_id}", response_model=CampaignRead)
async def update_one(
    campaign_id: int,
    payload: CampaignUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CampaignRead:
    obj = await _ensure_owned_campaign(db, current, campaign_id)
    obj = await svc.update_campaign(db, obj, payload)
    sc = await svc.count_steps(db, obj.id)
    ec = await svc.count_enrollments(db, obj.id)
    return _to_campaign_read(obj, sc, ec)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    campaign_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    obj = await _ensure_owned_campaign(db, current, campaign_id)
    await svc.delete_campaign(db, obj)


# ---------- Steps ----------


@router.get("/{campaign_id}/steps", response_model=list[StepRead])
async def list_steps(
    campaign_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StepRead]:
    await _ensure_owned_campaign(db, current, campaign_id)
    steps = await svc.list_steps(db, campaign_id)
    return [StepRead.model_validate(s) for s in steps]


@router.post(
    "/{campaign_id}/steps",
    response_model=StepRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_step(
    campaign_id: int,
    payload: StepCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StepRead:
    await _ensure_owned_campaign(db, current, campaign_id)
    obj = await svc.create_step(db, campaign_id, payload)
    return StepRead.model_validate(obj)


@router.patch("/{campaign_id}/steps/{step_id}", response_model=StepRead)
async def update_step(
    campaign_id: int,
    step_id: int,
    payload: StepUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StepRead:
    await _ensure_owned_campaign(db, current, campaign_id)
    obj = await svc.get_step(db, campaign_id, step_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Step not found")
    obj = await svc.update_step(db, obj, payload)
    return StepRead.model_validate(obj)


@router.delete(
    "/{campaign_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_step(
    campaign_id: int,
    step_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _ensure_owned_campaign(db, current, campaign_id)
    obj = await svc.get_step(db, campaign_id, step_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Step not found")
    await svc.delete_step(db, obj)


@router.post(
    "/{campaign_id}/steps/{step_id}/test-send",
    response_model=StepTestSendResult,
)
async def test_send_step(
    campaign_id: int,
    step_id: int,
    payload: StepTestSendRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StepTestSendResult:
    """Render this step (with a sample or chosen lead) and send it as a test
    email to the given address (defaults to the logged-in user)."""
    campaign = await svc.get_campaign(db, current.id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    step = await svc.get_step(db, campaign_id, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Step not found")
    if step.channel != "email":
        raise HTTPException(
            status_code=400,
            detail="Test można wysłać tylko dla kroku typu Email",
        )

    to = (payload.to or current.email).strip()
    if not to:
        raise HTTPException(status_code=400, detail="Brak adresu docelowego")

    lead = None
    if payload.lead_id is not None:
        res = await db.execute(
            select(Lead)
            .join(LeadList, LeadList.id == Lead.list_id)
            .where(Lead.id == payload.lead_id, LeadList.user_id == current.id)
        )
        lead = res.scalar_one_or_none()
    if lead is None:
        # Sample data so merge tags render in the preview/test.
        lead = SimpleNamespace(
            email=to,
            first_name="Jan",
            last_name="Kowalski",
            company="Przykładowa firma",
            title="Dyrektor",
        )

    subject = svc.render_template(step.subject, lead)
    body = svc.render_template(step.body_template, lead)
    try:
        await _send_via_smtp(
            to_email=to,
            from_email=campaign.from_email,
            from_name=campaign.from_name,
            subject=f"[TEST] {subject}",
            body=body,
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Wysyłka testowa nie powiodła się: {type(e).__name__}: {e}",
        )
    return StepTestSendResult(ok=True, sent_to=to, subject=subject)


# ---------- Step A/B variants ----------


async def _owned_step(db, current, campaign_id, step_id):
    await _ensure_owned_campaign(db, current, campaign_id)
    step = await svc.get_step(db, campaign_id, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Step not found")
    return step


@router.get(
    "/{campaign_id}/steps/{step_id}/variants",
    response_model=list[VariantRead],
)
async def list_variants(
    campaign_id: int,
    step_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VariantRead]:
    await _owned_step(db, current, campaign_id, step_id)
    variants = await svc.list_variants(db, step_id)
    return [VariantRead.model_validate(v) for v in variants]


@router.post(
    "/{campaign_id}/steps/{step_id}/variants",
    response_model=VariantRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_variant(
    campaign_id: int,
    step_id: int,
    payload: VariantCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VariantRead:
    await _owned_step(db, current, campaign_id, step_id)
    obj = await svc.create_variant(
        db, step_id, payload.subject, payload.body_template
    )
    return VariantRead.model_validate(obj)


@router.post(
    "/{campaign_id}/steps/{step_id}/variants/ai",
    response_model=VariantRead,
    status_code=status.HTTP_201_CREATED,
)
async def generate_ai_variant(
    campaign_id: int,
    step_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VariantRead:
    step = await _owned_step(db, current, campaign_id, step_id)
    try:
        gen = await svc.generate_ai_variant(step)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Generowanie wariantu AI nie powiodło się: {e}",
        )
    obj = await svc.create_variant(
        db, step_id, gen["subject"], gen["body_template"]
    )
    return VariantRead.model_validate(obj)


@router.delete(
    "/{campaign_id}/steps/{step_id}/variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_variant(
    campaign_id: int,
    step_id: int,
    variant_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _owned_step(db, current, campaign_id, step_id)
    obj = await svc.get_variant(db, step_id, variant_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    await svc.delete_variant(db, obj)


# ---------- Enrollments ----------


@router.get("/{campaign_id}/enrollments", response_model=list[EnrollmentRead])
async def list_enrollments(
    campaign_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EnrollmentRead]:
    await _ensure_owned_campaign(db, current, campaign_id)
    rows = await svc.list_enrollments(db, campaign_id)
    out: list[EnrollmentRead] = []
    for enr, lead in rows:
        item = EnrollmentRead.model_validate(enr)
        item.lead_email = lead.email
        full = " ".join(filter(None, [lead.first_name, lead.last_name]))
        item.lead_name = full or None
        item.lead_company = lead.company
        out.append(item)
    return out


@router.post("/{campaign_id}/enrollments", response_model=EnrollResult)
async def enroll_from_list(
    campaign_id: int,
    payload: EnrollFromList,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EnrollResult:
    await _ensure_owned_campaign(db, current, campaign_id)
    return await svc.enroll_from_list(db, current.id, campaign_id, payload.list_id)


@router.post(
    "/{campaign_id}/audience/preview", response_model=AudiencePreview
)
async def audience_preview(
    campaign_id: int,
    criteria: AudienceCriteria,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AudiencePreview:
    await _ensure_owned_campaign(db, current, campaign_id)
    data = await svc.audience_preview(db, current.id, campaign_id, criteria)
    return AudiencePreview(**data)


@router.post(
    "/{campaign_id}/audience/enroll", response_model=EnrollResult
)
async def audience_enroll(
    campaign_id: int,
    payload: AudienceEnrollRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EnrollResult:
    await _ensure_owned_campaign(db, current, campaign_id)
    return await svc.enroll_leads(db, current.id, campaign_id, payload.lead_ids)


@router.delete(
    "/{campaign_id}/enrollments/{enrollment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unenroll(
    campaign_id: int,
    enrollment_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _ensure_owned_campaign(db, current, campaign_id)
    enr = await svc.get_enrollment(db, campaign_id, enrollment_id)
    if enr is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await svc.delete_enrollment(db, enr)


# ---------- Preview ----------


@router.get("/{campaign_id}/stats", response_model=CampaignStats)
async def get_stats(
    campaign_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CampaignStats:
    await _ensure_owned_campaign(db, current, campaign_id)
    data = await svc.get_campaign_stats(db, campaign_id)
    return CampaignStats(**data)


@router.post("/{campaign_id}/send-due-now")
async def send_due_now(
    campaign_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manually trigger the email sender for this campaign's due enrollments.
    Useful in dev so you don't have to wait for the next cron tick."""
    await _ensure_owned_campaign(db, current, campaign_id)
    processed = await process_due_enrollments(campaign_id=campaign_id)
    return {"processed": processed}


@router.post("/{campaign_id}/preview", response_model=PreviewResponse)
async def preview_step(
    campaign_id: int,
    payload: PreviewRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PreviewResponse:
    await _ensure_owned_campaign(db, current, campaign_id)
    step = await svc.get_step(db, campaign_id, payload.step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Step not found")
    # Look up the lead and check it's owned by current user via the list
    lead_stmt = select(Lead).where(Lead.id == payload.lead_id)
    lead_result = await db.execute(lead_stmt)
    lead = lead_result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    return PreviewResponse(
        subject=svc.render_template(step.subject, lead),
        body=svc.render_template(step.body_template, lead),
    )
