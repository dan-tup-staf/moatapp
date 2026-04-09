from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SourceType(str, Enum):
    RSS = "rss"
    # placeholders for future scrapers
    JOB_POSTING = "job_posting"
    NEWS = "news"
    TECH_CHANGE = "tech_change"


# ---------- SignalSource ----------


class SignalSourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: SourceType
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    score_weight: int = Field(default=5, ge=0, le=1000)


class SignalSourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    config: dict[str, Any] | None = None
    enabled: bool | None = None
    score_weight: int | None = Field(default=None, ge=0, le=1000)


class SignalSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: SourceType
    config: dict[str, Any]
    enabled: bool
    score_weight: int
    last_run_at: datetime | None
    last_error: str | None
    created_at: datetime
    signals_count: int = 0


class RunResult(BaseModel):
    new_signals: int
    error: str | None = None


# ---------- Signal ----------


class SignalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_id: int
    source_name: str | None = None
    lead_id: int | None
    lead_email: str | None = None
    company_domain: str | None
    title: str
    url: str | None
    payload: dict[str, Any]
    score_weight: int
    detected_at: datetime
