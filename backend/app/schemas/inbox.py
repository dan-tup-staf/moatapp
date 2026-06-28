from datetime import datetime

from pydantic import BaseModel


class InboxMessage(BaseModel):
    id: int
    from_email: str
    subject: str
    body: str
    received_at: datetime | None
    is_read: bool
    lead_id: int | None
    lead_name: str | None
    lead_company: str | None


class ReplyRequest(BaseModel):
    body: str


class ReadRequest(BaseModel):
    read: bool = True
