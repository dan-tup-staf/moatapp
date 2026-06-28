"""watchlists of companies/people to track with signal sources

Revision ID: 0029
Revises: 0028
Create Date: 2026-06-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "description",
            sa.String(length=512),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "kind", sa.String(length=16), nullable=False, server_default="company"
        ),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_table(
        "watchlist_entities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "watchlist_id",
            sa.Integer(),
            sa.ForeignKey("watchlists.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "kind", sa.String(length=16), nullable=False, server_default="company"
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("linkedin_url", sa.Text(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("industry", sa.String(length=255), nullable=True),
        sa.Column(
            "extra",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("watchlist_entities")
    op.drop_table("watchlists")
