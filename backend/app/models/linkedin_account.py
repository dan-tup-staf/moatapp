from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LinkedInAccount(Base):
    """A connected LinkedIn profile used to drive outreach via LinkedIn's
    internal "Voyager" API — the same approach HeyReach / lemlist / LaGrowth
    use (no official API allows outreach).

    The session is captured as the `li_at` auth cookie + the JSESSIONID (which
    doubles as the CSRF token). Both are encrypted at rest. An optional per-
    account proxy keeps the session pinned to one IP (LinkedIn flags logins
    that hop across datacenter IPs). Daily caps + a sending window keep activity
    human-like to reduce ban risk.
    """

    __tablename__ = "linkedin_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Display name + the resolved LinkedIn member identity (filled on verify).
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    member_urn: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Encrypted session secrets (Fernet ciphertext).
    li_at_enc: Mapped[str] = mapped_column(
        String(2048), nullable=False, server_default=""
    )
    jsessionid_enc: Mapped[str] = mapped_column(
        String(2048), nullable=False, server_default=""
    )
    # Optional dedicated proxy, e.g. http://user:pass@host:port
    proxy_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # disconnected | connected | error
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="disconnected"
    )
    last_check_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    daily_limit_invites: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="20"
    )
    daily_limit_messages: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="40"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
