from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SequenceStep(Base):
    __tablename__ = "sequence_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Position in sequence (0-indexed). Renamed from `order` to avoid SQL keyword
    # collision and ambiguity in queries.
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    # Days to wait after the previous step (or after enrollment, for step 0)
    delay_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
