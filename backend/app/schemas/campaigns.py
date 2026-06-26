from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class StepChannel(str, Enum):
    EMAIL = "email"
    LINKEDIN_VISIT = "linkedin_visit"
    LINKEDIN_INVITE = "linkedin_invite"
    LINKEDIN_MESSAGE = "linkedin_message"
    CALL = "call"
    WHATSAPP = "whatsapp"
    TASK = "task"


class EnrollmentStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    REPLIED = "replied"
    BOUNCED = "bounced"


# ---------- SequenceStep ----------


class StepCreate(BaseModel):
    step_order: int = Field(ge=0)
    subject: str = Field(min_length=1, max_length=255)
    body_template: str = Field(min_length=1)
    delay_days: int = Field(default=0, ge=0, le=365)
    channel: StepChannel = StepChannel.EMAIL


class StepUpdate(BaseModel):
    step_order: int | None = Field(default=None, ge=0)
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    body_template: str | None = Field(default=None, min_length=1)
    delay_days: int | None = Field(default=None, ge=0, le=365)
    channel: StepChannel | None = None


class StepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    step_order: int
    subject: str
    body_template: str
    delay_days: int
    channel: StepChannel


class VariantCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    body_template: str = Field(min_length=1)


class VariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    step_id: int
    subject: str
    body_template: str
    created_at: datetime


# ---------- Campaign ----------


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    from_email: EmailStr
    from_name: str | None = Field(default=None, max_length=255)
    scheduled_at: datetime | None = None
    group_id: int | None = None


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    from_email: EmailStr | None = None
    from_name: str | None = Field(default=None, max_length=255)
    status: CampaignStatus | None = None
    scheduled_at: datetime | None = None
    group_id: int | None = None
    send_window_start_hour: int | None = Field(default=None, ge=0, le=24)
    send_window_end_hour: int | None = Field(default=None, ge=0, le=24)
    send_days: str | None = Field(default=None, max_length=32)
    include_unsubscribe: bool | None = None
    unsubscribe_text: str | None = None
    track_opens: bool | None = None


class CampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: CampaignStatus
    from_email: EmailStr
    from_name: str | None
    group_id: int | None = None
    scheduled_at: datetime | None = None
    send_window_start_hour: int = 0
    send_window_end_hour: int = 24
    send_days: str = "1,2,3,4,5,6,7"
    include_unsubscribe: bool = False
    unsubscribe_text: str | None = None
    track_opens: bool = False
    created_at: datetime
    updated_at: datetime
    steps_count: int = 0
    enrollments_count: int = 0


# ---------- Enrollment ----------


class EnrollFromList(BaseModel):
    list_id: int


class EnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    lead_id: int
    current_step: int
    next_send_at: datetime | None
    status: EnrollmentStatus
    created_at: datetime
    updated_at: datetime
    # Denormalized lead info for the enrollment listing
    lead_email: str | None = None
    lead_name: str | None = None
    lead_company: str | None = None


class EnrollResult(BaseModel):
    enrolled: int
    skipped_already_enrolled: int


# ---------- Audience builder ----------


class AudienceCriteria(BaseModel):
    """Targetowanie dla kampanii — zwraca listę leadów pasujących do kryteriów.
    Każdy filtr niezależny; puste/None = bez ograniczeń dla tego wymiaru."""

    include_list_ids: list[int] = Field(default_factory=list)
    exclude_list_ids: list[int] = Field(default_factory=list)
    # Tier: 1 (score > 100), 2 (20-100), 3 (< 20). Empty list = all.
    tiers: list[int] = Field(default_factory=list)
    # Signal source strength 0-5 — leads muszą mieć signal z source'a o strength >= N
    min_source_strength: int | None = Field(default=None, ge=0, le=5)
    # Explicit source id include
    signal_source_ids: list[int] = Field(default_factory=list)
    # Fragment tytułu sygnału (ILIKE)
    signal_title_query: str | None = None


class AudienceLead(BaseModel):
    """Lead row in audience preview with enrollment status hint."""

    id: int
    email: str
    first_name: str | None
    last_name: str | None
    company: str | None
    title: str | None
    score: int
    tier: int
    list_id: int
    list_name: str
    signals_count: int
    already_enrolled: bool


class AudiencePreview(BaseModel):
    leads: list[AudienceLead]
    matched_total: int
    already_enrolled_count: int


class AudienceEnrollRequest(BaseModel):
    lead_ids: list[int] = Field(min_length=1)


# ---------- Preview ----------


class PreviewRequest(BaseModel):
    step_id: int
    lead_id: int


class PreviewResponse(BaseModel):
    subject: str
    body: str


class StepTestSendRequest(BaseModel):
    to: str | None = None
    lead_id: int | None = None


class StepTestSendResult(BaseModel):
    ok: bool
    sent_to: str
    subject: str


# ---------- Campaign stats ----------


class StepStats(BaseModel):
    step_id: int
    step_order: int
    sent_count: int
    failed_count: int
    opened_count: int = 0


class EnrollmentsBreakdown(BaseModel):
    total: int
    active: int
    completed: int
    paused: int
    replied: int
    bounced: int


class CampaignPipelineStage(BaseModel):
    stage: str  # awareness | education | requirements | vendor_selection
    name: str
    companies_count: int
    total_score: int
    tier1: int
    tier2: int
    tier3: int


class CampaignStats(BaseModel):
    """Per-step + overall metrics for the lemlist-style detail view."""

    enrollments: EnrollmentsBreakdown
    messages_sent_total: int
    messages_failed_total: int
    steps: list[StepStats]
    pipeline: list[CampaignPipelineStage]
