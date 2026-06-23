from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SourceType(str, Enum):
    RSS = "rss"
    PRACUJ_PL = "pracuj_pl"
    # web_search-backed channels (Claude server-side web_search)
    LINKEDIN = "linkedin"
    GOOGLE_NEWS = "google_news"
    X_TWITTER = "x_twitter"
    SERP = "serp"
    FUNDING = "funding"
    COMPANY_SITE = "company_site"


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


class SignalSourceBatchCreate(BaseModel):
    sources: list[SignalSourceCreate] = Field(default_factory=list)


class RunResult(BaseModel):
    new_signals: int
    error: str | None = None


# ---------- Presets (curated PL-enterprise source templates) ----------


class SignalSourcePreset(BaseModel):
    key: str
    category: str
    category_label: str
    name: str
    type: SourceType
    score_weight: int
    description: str
    config: dict[str, Any]


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


# ---------- Signal summary (aggregated per source) ----------


class SignalSummary(BaseModel):
    """Aggregated view of one signal source: how many detections, how many
    distinct companies, how much score added to leads, how fresh, etc. Used
    for the top-level /signals view where each card represents one source."""

    source_id: int
    source_name: str
    source_type: SourceType
    enabled: bool
    signals_count: int
    unique_companies: int
    linked_signals_count: int
    linked_leads_count: int
    pipeline_impact: int
    latest_signal_at: datetime | None
    last_run_at: datetime | None
