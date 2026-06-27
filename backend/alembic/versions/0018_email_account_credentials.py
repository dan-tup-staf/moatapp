"""email account SMTP credentials (per-account sending)

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_accounts",
        sa.Column(
            "smtp_password_enc",
            sa.String(length=1024),
            nullable=False,
            server_default="",
        ),
    )
    op.add_column(
        "email_accounts",
        sa.Column(
            "smtp_security",
            sa.String(length=16),
            nullable=False,
            server_default="starttls",
        ),
    )
    op.add_column(
        "email_accounts",
        sa.Column(
            "verified",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "email_accounts",
        sa.Column("last_test_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "email_accounts",
        sa.Column("last_error", sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    for col in (
        "last_error",
        "last_test_at",
        "verified",
        "smtp_security",
        "smtp_password_enc",
    ):
        op.drop_column("email_accounts", col)
