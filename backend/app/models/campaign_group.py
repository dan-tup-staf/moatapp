from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CampaignGroup(Base):
    """Umbrella "Campaign" that groups multiple sequences. Sequences are the
    existing `campaigns` rows (which own steps/enrollments/sending). This adds a
    grouping layer on top without touching the sending pipeline."""

    __tablename__ = "campaign_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
