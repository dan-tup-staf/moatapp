from pydantic import BaseModel, ConfigDict


class DashboardStats(BaseModel):
    leads_total: int
    leads_contacted: int
    campaigns_total: int
    campaigns_active: int
    messages_sent_total: int
    messages_sent_last_7d: int
    signals_total: int
    signals_last_7d: int
    active_enrollments: int


class HotLeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str | None
    last_name: str | None
    company: str | None
    title: str | None
    status: str
    score: int
    list_id: int
    list_name: str
    signals_count: int
