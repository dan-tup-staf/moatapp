from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class PipelineStage(str, Enum):
    AWARENESS = "awareness"
    EDUCATION = "education"
    REQUIREMENTS = "requirements"
    VENDOR_SELECTION = "vendor_selection"


class PipelineCompany(BaseModel):
    company: str
    leads_count: int
    total_score: int
    tier: int  # 1 | 2 | 3
    signals_count: int
    last_activity_at: datetime | None


class PipelineStageBucket(BaseModel):
    stage: PipelineStage
    name: str  # human label
    companies: list[PipelineCompany]
    companies_count: int
    total_score: int


class PipelineView(BaseModel):
    stages: list[PipelineStageBucket]
