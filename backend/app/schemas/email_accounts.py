from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class WarmupStatus(str, Enum):
    OFF = "off"
    WARMING = "warming"
    READY = "ready"
    PAUSED = "paused"


class EmailAccountCreate(BaseModel):
    email: EmailStr
    from_name: str | None = Field(default=None, max_length=255)
    provider: str = Field(default="smtp", max_length=32)
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, max_length=255)
    daily_limit: int = Field(default=50, ge=0, le=100000)
    tags: list[str] = Field(default_factory=list)


class EmailAccountUpdate(BaseModel):
    from_name: str | None = Field(default=None, max_length=255)
    provider: str | None = Field(default=None, max_length=32)
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, max_length=255)
    daily_limit: int | None = Field(default=None, ge=0, le=100000)
    tags: list[str] | None = None
    warmup_status: WarmupStatus | None = None
    active: bool | None = None


class EmailAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    from_name: str | None
    provider: str
    smtp_host: str | None
    smtp_port: int | None
    smtp_username: str | None
    daily_limit: int
    tags: list[str] = Field(default_factory=list)
    warmup_status: WarmupStatus
    active: bool
    created_at: datetime


class SetupCheck(BaseModel):
    ok: bool
    detail: str


class EmailAccountSetup(BaseModel):
    """Setup score breakdown for one mailbox (DNS via DoH + SMTP config)."""

    domain: str
    score: int
    max_score: int = 100
    checks: dict[str, SetupCheck]
