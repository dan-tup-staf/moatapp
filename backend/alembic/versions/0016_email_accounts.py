"""email_accounts (sending mailboxes for Deliverability screen)

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("from_name", sa.String(length=255), nullable=True),
        sa.Column(
            "provider", sa.String(length=32), nullable=False, server_default="smtp"
        ),
        sa.Column("smtp_host", sa.String(length=255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=True),
        sa.Column("smtp_username", sa.String(length=255), nullable=True),
        sa.Column(
            "daily_limit", sa.Integer(), nullable=False, server_default="50"
        ),
        sa.Column("tags", sa.String(length=512), nullable=False, server_default=""),
        sa.Column(
            "warmup_status",
            sa.String(length=32),
            nullable=False,
            server_default="off",
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
        sa.UniqueConstraint("user_id", "email", name="uq_email_accounts_user_email"),
    )
    op.create_index(
        "ix_email_accounts_user_id", "email_accounts", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_email_accounts_user_id", table_name="email_accounts")
    op.drop_table("email_accounts")
