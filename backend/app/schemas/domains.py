from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DomainCreate(BaseModel):
    domain: str


class DomainRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    created_at: datetime


class CheckItem(BaseModel):
    ok: bool
    detail: str


class DomainHealth(BaseModel):
    domain: str
    checks: dict[str, CheckItem]
    score: int
    max_score: int
    healthy: bool
