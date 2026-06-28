from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WebhookCreate(BaseModel):
    url: str = Field(min_length=8, max_length=1024)
    secret: str = Field(default="", max_length=128)
    events: list[str] = Field(default_factory=list)


class WebhookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    events: list[str] = Field(default_factory=list)
    active: bool
    last_status: int | None = None
    last_error: str | None = None
    last_fired_at: datetime | None = None
    created_at: datetime


class WebhookTestResult(BaseModel):
    ok: bool
    detail: str
