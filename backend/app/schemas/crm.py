from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class CompanyRow(BaseModel):
    """Aggregated per-company row for the Firmy tab. A 'company' is the
    distinct normalized value of Lead.company across all the user's lists."""

    company: str
    leads_count: int
    total_score: int
    highest_status: str  # replied > contacted > new > bounced > unsubscribed
    signals_count: int
    active_enrollments: int
    last_message_sent_at: datetime | None


class PersonRow(BaseModel):
    """Flat row for the Osoby tab — one per lead across all the user's lists,
    with denormalized list + activity info."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    first_name: str | None
    last_name: str | None
    company: str | None
    title: str | None
    status: str
    score: int
    list_id: int
    list_name: str
    signals_count: int
    last_message_sent_at: datetime | None
    created_at: datetime
