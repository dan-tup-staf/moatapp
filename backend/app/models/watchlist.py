from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Watchlist(Base):
    """A named list of companies and/or people the user wants to track with
    signal sources. Attach a watchlist to a signal source (config.watchlist_id)
    and the source scopes its scraping to those entities."""

    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(
        String(512), nullable=False, server_default=""
    )
    # company | person | mixed — informational; entities carry their own kind.
    kind: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="company"
    )
    # Optional LinkedIn search URL (or any source URL) the list was built from.
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class WatchlistEntity(Base):
    """One company or person inside a watchlist."""

    __tablename__ = "watchlist_entities"

    id: Mapped[int] = mapped_column(primary_key=True)
    watchlist_id: Mapped[int] = mapped_column(
        ForeignKey("watchlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # company | person
    kind: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="company"
    )
    # For a company: the company name. For a person: their full name.
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # For a person: the company they work at (used to build queries / linking).
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
