"""linkedin_accounts (Voyager-based LinkedIn outreach)

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "linkedin_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("member_urn", sa.String(length=255), nullable=True),
        sa.Column(
            "li_at_enc", sa.String(length=2048), nullable=False, server_default=""
        ),
        sa.Column(
            "jsessionid_enc",
            sa.String(length=2048),
            nullable=False,
            server_default="",
        ),
        sa.Column("proxy_url", sa.String(length=512), nullable=True),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="disconnected",
        ),
        sa.Column("last_check_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=1024), nullable=True),
        sa.Column(
            "daily_limit_invites",
            sa.Integer(),
            nullable=False,
            server_default="20",
        ),
        sa.Column(
            "daily_limit_messages",
            sa.Integer(),
            nullable=False,
            server_default="40",
        ),
        sa.Column(
            "active", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("linkedin_accounts")
