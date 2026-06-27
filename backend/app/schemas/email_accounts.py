from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class WarmupStatus(str, Enum):
    OFF = "off"
    WARMING = "warming"
    READY = "ready"
    PAUSED = "paused"


class SmtpSecurity(str, Enum):
    STARTTLS = "starttls"
    SSL = "ssl"
    NONE = "none"


class EmailAccountCreate(BaseModel):
    email: EmailStr
    from_name: str | None = Field(default=None, max_length=255)
    provider: str = Field(default="smtp", max_length=32)
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, max_length=512)
    smtp_security: SmtpSecurity = SmtpSecurity.STARTTLS
    imap_host: str | None = Field(default=None, max_length=255)
    imap_port: int = Field(default=993, ge=1, le=65535)
    daily_limit: int = Field(default=50, ge=0, le=100000)
    tags: list[str] = Field(default_factory=list)


class EmailAccountUpdate(BaseModel):
    from_name: str | None = Field(default=None, max_length=255)
    provider: str | None = Field(default=None, max_length=32)
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, max_length=255)
    # Omit to keep the existing password; pass a new value to replace it.
    smtp_password: str | None = Field(default=None, max_length=512)
    smtp_security: SmtpSecurity | None = None
    imap_host: str | None = Field(default=None, max_length=255)
    imap_port: int | None = Field(default=None, ge=1, le=65535)
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
    smtp_security: SmtpSecurity = SmtpSecurity.STARTTLS
    imap_host: str | None = None
    imap_port: int = 993
    # Never expose the password; just whether one is stored.
    has_password: bool = False
    verified: bool = False
    last_test_at: datetime | None = None
    last_error: str | None = None
    daily_limit: int
    tags: list[str] = Field(default_factory=list)
    warmup_status: WarmupStatus
    warmup_started_at: datetime | None = None
    warmup_day: int = 0
    effective_daily_limit: int = 0
    active: bool
    created_at: datetime


class EmailAccountTestResult(BaseModel):
    ok: bool
    detail: str


class SetupCheck(BaseModel):
    ok: bool
    detail: str


class EmailAccountSetup(BaseModel):
    """Setup score breakdown for one mailbox (DNS via DoH + SMTP config)."""

    domain: str
    score: int
    max_score: int = 100
    checks: dict[str, SetupCheck]
