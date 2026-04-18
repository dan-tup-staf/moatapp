from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class IcpProfile(Base):
    """Ideal Customer Profile — one per user. Built via 3-stage flow:
    1. User provides company URL → we scrape basic info
    2. LLM generates clarifying questions → user answers
    3. LLM synthesizes ICP from scraped info + Q&A → user can edit"""

    __tablename__ = "icp_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_icp_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    scraped_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # [{"question": "...", "answer": "..."}]
    qa_history: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    # Editable ICP fields: target_industries, company_size, buyer_persona_titles,
    # pain_points, triggers, notes
    icp_fields: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
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
