from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class AnalyzeUrlRequest(BaseModel):
    url: HttpUrl | None = None
    # Fallback — jeśli strona blokuje scraping (Cloudflare/403),
    # user wkleja opis firmy ręcznie. Co najmniej jedno z pól wymagane.
    manual_description: str | None = None


class AnalyzeUrlResponse(BaseModel):
    scraped_summary: str
    suggested_questions: list[str]


class QAPair(BaseModel):
    question: str
    answer: str


class SynthesizeRequest(BaseModel):
    qa: list[QAPair] = Field(default_factory=list)


class IcpFields(BaseModel):
    """Editable ICP fields. All optional — user fills what they know."""

    target_industries: list[str] = Field(default_factory=list)
    company_size: str = ""
    buyer_persona_titles: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    triggers: list[str] = Field(default_factory=list)
    notes: str = ""


class IcpProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_url: str | None
    scraped_summary: str | None
    qa_history: list[dict[str, Any]]
    icp_fields: IcpFields
    created_at: datetime
    updated_at: datetime


class SuggestedSource(BaseModel):
    """A signal source proposed by the discovery flow from the user's ICP.
    Maps 1:1 to a SignalSourceCreate when the user activates it."""

    type: str  # web_search channel: linkedin | google_news | x_twitter | serp | funding | company_site
    name: str
    query: str
    rationale: str
    score_weight: int = 20
    max_results: int = 15


class SuggestSourcesResponse(BaseModel):
    sources: list[SuggestedSource] = Field(default_factory=list)


class IcpFieldsUpdate(BaseModel):
    target_industries: list[str] | None = None
    company_size: str | None = None
    buyer_persona_titles: list[str] | None = None
    pain_points: list[str] | None = None
    triggers: list[str] | None = None
    notes: str | None = None
