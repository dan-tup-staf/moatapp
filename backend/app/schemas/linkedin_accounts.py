from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LinkedInAccountCreate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    # The two session secrets captured from the browser.
    li_at: str = Field(min_length=10, max_length=2048)
    jsessionid: str = Field(min_length=4, max_length=2048)
    proxy_url: str | None = Field(default=None, max_length=512)
    daily_limit_invites: int = Field(default=20, ge=0, le=200)
    daily_limit_messages: int = Field(default=40, ge=0, le=500)


class LinkedInAccountUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    li_at: str | None = Field(default=None, max_length=2048)
    jsessionid: str | None = Field(default=None, max_length=2048)
    proxy_url: str | None = Field(default=None, max_length=512)
    daily_limit_invites: int | None = Field(default=None, ge=0, le=200)
    daily_limit_messages: int | None = Field(default=None, ge=0, le=500)
    active: bool | None = None


class LinkedInAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None
    member_urn: str | None
    # Never expose secrets — just whether a session is stored.
    has_session: bool = False
    proxy_url: str | None
    status: str
    last_check_at: datetime | None
    last_error: str | None
    daily_limit_invites: int
    daily_limit_messages: int
    active: bool
    created_at: datetime


class LinkedInTestResult(BaseModel):
    ok: bool
    detail: str
