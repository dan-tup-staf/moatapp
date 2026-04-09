from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    REPLIED = "replied"
    BOUNCED = "bounced"
    UNSUBSCRIBED = "unsubscribed"


# ---------- LeadList ----------


class LeadListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class LeadListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class LeadListRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    leads_count: int = 0


# ---------- Lead ----------


class LeadCreate(BaseModel):
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    title: str | None = None
    linkedin_url: str | None = None
    website: str | None = None
    status: LeadStatus = LeadStatus.NEW
    notes: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class LeadUpdate(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    title: str | None = None
    linkedin_url: str | None = None
    website: str | None = None
    status: LeadStatus | None = None
    score: int | None = None
    notes: str | None = None
    extra: dict[str, Any] | None = None


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    list_id: int
    email: EmailStr
    first_name: str | None
    last_name: str | None
    company: str | None
    title: str | None
    linkedin_url: str | None
    website: str | None
    status: LeadStatus
    score: int
    notes: str | None
    extra: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CsvImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str] = Field(default_factory=list)
