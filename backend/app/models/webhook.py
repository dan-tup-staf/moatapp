from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Webhook(Base):
    """Outbound webhook — MOATION POSTs sales events (reply / outcome / bounce)
    as signed JSON to a user-configured URL. Provider-agnostic: point it at
    Zapier / Make / n8n / a custom endpoint to push into any CRM.
    """

    __tablename__ = "webhooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    # Shared secret for the HMAC signature header (X-Moation-Signature).
    secret: Mapped[str] = mapped_column(String(128), nullable=False, server_default="")
    # Comma-separated event names this hook wants; empty = all events.
    events: Mapped[str] = mapped_column(String(512), nullable=False, server_default="")
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    last_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    last_fired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
