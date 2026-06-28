from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional umbrella "Campaign" (group) this sequence belongs to.
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("campaign_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Optional scheduled start: when set in the future, step-1 sends wait until
    # this moment instead of going out immediately on enroll.
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Sending window (hours interpreted in UTC for MVP) + allowed weekdays
    # (ISO 1=Mon..7=Sun, CSV). Emails only go out inside this window.
    send_window_start_hour: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    send_window_end_hour: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="24"
    )
    send_days: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="1,2,3,4,5,6,7"
    )
    # Unsubscribe footer appended to outgoing emails.
    include_unsubscribe: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    unsubscribe_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Open tracking via a 1x1 pixel (requires HTML email — small deliverability
    # tradeoff, hence opt-in). Needs settings.tracking_base_url to be set.
    track_opens: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    # --- Saleshandy-style sequence settings ---
    # Safety toggles
    stop_on_reply: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    track_clicks: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    text_only: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    same_thread: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    # ESP matching: prefer a sender mailbox whose provider matches the
    # recipient's ESP (Google→Google, Microsoft→Microsoft) during rotation.
    esp_matching: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    # Constant Cc/Bcc (comma-separated) applied to every email in the sequence.
    cc: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bcc: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Mailbox rotation: comma-separated EmailAccount ids to spread sends across.
    # Empty = single mailbox (from_email). Assigned per-prospect for thread
    # consistency.
    sender_account_ids: Mapped[str] = mapped_column(
        String(255), nullable=False, server_default=""
    )
    # prioritise_followups | prioritise_new | balanced | aggressive
    sending_priority: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="balanced"
    )
    # Estimated deal value per prospect (used for pipeline revenue rollups).
    deal_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
