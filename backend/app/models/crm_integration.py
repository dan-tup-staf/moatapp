from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CrmIntegration(Base):
    """A user's connection to a CRM (Livespace / HubSpot / Pipedrive /
    Salesforce). Credentials stored encrypted; `extra` carries provider-specific
    config (e.g. account domain). The push mechanism is finished once real
    credentials are supplied — this is the connection scaffold + targets for the
    sequence-goal feature."""

    __tablename__ = "crm_integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # livespace | hubspot | pipedrive | salesforce
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    api_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    # e.g. {"domain": "mojafirma", "api_secret_enc": "..."}
    extra: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
