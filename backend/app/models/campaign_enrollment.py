from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CampaignEnrollment(Base):
    __tablename__ = "campaign_enrollments"
    __table_args__ = (
        UniqueConstraint(
            "campaign_id", "lead_id", name="uq_enrollment_campaign_lead"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 0-indexed pointer to the next step to send (0 = haven't sent anything yet)
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_send_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    # Manual outcome set by the user (interested / meeting_booked / closed_won /
    # not_interested / out_of_office). Drives the prospect funnel + outcome column.
    outcome: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Comma-separated free-form tags for filtering/segmentation.
    tags: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
