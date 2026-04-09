from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


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


class StepUpdate(BaseModel):
    step_order: int | None = Field(default=None, ge=0)
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    body_template: str | None = Field(default=None, min_length=1)
    delay_days: int | None = Field(default=None, ge=0, le=365)


class StepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    step_order: int
    subject: str
    body_template: str
    delay_days: int


# ---------- Campaign ----------


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    from_email: EmailStr
    from_name: str | None = Field(default=None, max_length=255)


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    from_email: EmailStr | None = None
    from_name: str | None = Field(default=None, max_length=255)
    status: CampaignStatus | None = None


class CampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: CampaignStatus
    from_email: EmailStr
    from_name: str | None
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


# ---------- Preview ----------


class PreviewRequest(BaseModel):
    step_id: int
    lead_id: int


class PreviewResponse(BaseModel):
    subject: str
    body: str
