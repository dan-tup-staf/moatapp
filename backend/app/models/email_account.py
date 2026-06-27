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
