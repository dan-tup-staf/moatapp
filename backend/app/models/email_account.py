from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EmailAccount(Base):
    """A sending mailbox shown on the Deliverability / Email Accounts screen.

    For MVP the actual SMTP transport still uses the env-configured mailbox;
    these rows drive the Saleshandy-style accounts table (setup score, warm-up
    status, daily limit, tags) and prepare for sender rotation later.
    """

    __tablename__ = "email_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "email", name="uq_email_accounts_user_email"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # smtp | google | microsoft | other
    provider: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="smtp"
    )
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Encrypted-at-rest SMTP password (Fernet ciphertext). "" = not set.
    smtp_password_enc: Mapped[str] = mapped_column(
        String(1024), nullable=False, server_default=""
    )
    # starttls (587) | ssl (465) | none
    smtp_security: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="starttls"
    )
    # IMAP for reply detection (login reuses smtp_username + smtp_password).
    imap_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    imap_port: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="993"
    )
    last_reply_check_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Whether the last "test connection" succeeded.
    verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    last_test_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    daily_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="50"
    )
    tags: Mapped[str] = mapped_column(String(512), nullable=False, server_default="")
    # off | warming | ready | paused
    warmup_status: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="off"
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
