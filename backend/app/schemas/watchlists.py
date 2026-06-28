from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EntityKind(str, Enum):
    COMPANY = "company"
    PERSON = "person"


# ---------- Entities ----------


class EntityCreate(BaseModel):
    kind: EntityKind = EntityKind.COMPANY
    name: str = Field(min_length=1, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    linkedin_url: str | None = None
    title: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    extra: dict[str, Any] = Field(default_factory=dict)


class EntityUpdate(BaseModel):
    kind: EntityKind | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    domain: str | None = Field(default=None, max_length=255)
    linkedin_url: str | None = None
    title: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=255)


class EntityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    watchlist_id: int
    kind: EntityKind
    name: str
    company: str | None
    domain: str | None
    linkedin_url: str | None
    title: str | None
    location: str | None
    industry: str | None
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class EntityBulkCreate(BaseModel):
    entities: list[EntityCreate] = Field(default_factory=list)


class EntityBulkDelete(BaseModel):
    entity_ids: list[int] = Field(min_length=1)


# ---------- Watchlist ----------


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=512)
    kind: str = Field(default="company", max_length=16)
    source_url: str | None = None


class WatchlistUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=512)
    kind: str | None = Field(default=None, max_length=16)
    source_url: str | None = None


class WatchlistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    kind: str
    source_url: str | None
    created_at: datetime
    updated_at: datetime
    entities_count: int = 0
    companies_count: int = 0
    people_count: int = 0


class WatchlistDetail(WatchlistRead):
    entities: list[EntityRead] = Field(default_factory=list)


# ---------- CSV import ----------


class CsvImportRequest(BaseModel):
    kind: EntityKind = EntityKind.COMPANY
    csv_text: str = Field(min_length=1)


class CsvImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


# ---------- Prospect search (Lusha / Prospeo-style) ----------


class ProspectSearchRequest(BaseModel):
    """Filter-driven discovery of companies or people. Backed by the active web
    search provider (Brave / SerpAPI / DuckDuckGo) — no paid data vendor."""

    kind: EntityKind = EntityKind.COMPANY
    keywords: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    size: str | None = Field(default=None, max_length=64)
    max_results: int = Field(default=20, ge=1, le=50)


class ProspectCandidate(BaseModel):
    kind: EntityKind
    name: str
    company: str | None = None
    domain: str | None = None
    linkedin_url: str | None = None
    title: str | None = None
    location: str | None = None
    industry: str | None = None
    summary: str | None = None
    source_url: str | None = None


class ProspectSearchResult(BaseModel):
    provider: str
    candidates: list[ProspectCandidate] = Field(default_factory=list)


class AddFromSearchRequest(BaseModel):
    candidates: list[ProspectCandidate] = Field(min_length=1)
