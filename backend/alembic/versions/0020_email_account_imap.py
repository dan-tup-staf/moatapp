"""email account IMAP fields (reply detection)

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_accounts",
        sa.Column("imap_host", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "email_accounts",
        sa.Column(
            "imap_port", sa.Integer(), nullable=False, server_default="993"
        ),
    )
    op.add_column(
        "email_accounts",
        sa.Column(
            "last_reply_check_at", sa.DateTime(timezone=True), nullable=True
        ),
    )


def downgrade() -> None:
    for col in ("last_reply_check_at", "imap_port", "imap_host"):
        op.drop_column("email_accounts", col)
