from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EnrichmentIntegration(Base):
    """A user's connection to a data-enrichment provider (Apollo / Lusha /
    Prospeo). Stores the API key encrypted. The actual enrichment mechanism is
    built once a real key is provided — this is the connection scaffold."""

    __tablename__ = "enrichment_integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # apollo | lusha | prospeo
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    api_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
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
