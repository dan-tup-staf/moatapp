from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ScoringConfig(Base):
    """Per-user lead/company scoring settings. Today: the tier thresholds used
    to bucket companies (sum of their leads' scores) into Tier 1/2/3. Points
    themselves come from each signal source's score_weight."""

    __tablename__ = "scoring_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    # A company with score > tier1_min is Tier 1; > tier2_min is Tier 2;
    # > 0 is Tier 3; 0 is unqualified.
    tier1_min: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="100"
    )
    tier2_min: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="20"
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
