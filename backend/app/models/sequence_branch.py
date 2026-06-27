from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SequenceBranch(Base):
    """A conditional branch ("subsequence") rule on a sequence.

    Read as: after step `after_step_order`, if the prospect matches
    `condition`, run `action`. Persisted + shown 1:1 in the Subsequence tab;
    worker execution lands in a later milestone (linear send today).
    """

    __tablename__ = "sequence_branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Branch is evaluated after the step at this 0-indexed position.
    after_step_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # opened | not_opened | clicked | not_clicked | replied | not_replied
    condition: Mapped[str] = mapped_column(String(32), nullable=False)
    # stop | mark_outcome | add_tag
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    # Payload for the action (outcome value or tag name).
    outcome: Mapped[str | None] = mapped_column(String(32), nullable=True)
    tag: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
