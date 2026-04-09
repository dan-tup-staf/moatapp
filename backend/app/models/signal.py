from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Signal(Base):
    """A single intent event detected by a SignalSource (e.g. a job posting,
    a news article, a tech-stack change). Linked to a Lead by company domain
    matching when possible; otherwise stays orphan until a matching lead is
    added later."""

    __tablename__ = "signals"
    __table_args__ = (
        # Per-source dedup by URL. NULL urls don't dedup (Postgres treats
        # NULLs as distinct in unique constraints) — acceptable for MVP.
        UniqueConstraint("source_id", "url", name="uq_signal_source_url"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("signal_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    company_domain: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    score_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
