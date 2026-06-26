"""campaigns: Saleshandy sequence settings (safety toggles, cc/bcc, priority, deal_value)

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column("stop_on_reply", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "campaigns",
        sa.Column("track_clicks", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "campaigns",
        sa.Column("text_only", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "campaigns",
        sa.Column("same_thread", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("campaigns", sa.Column("cc", sa.String(length=512), nullable=True))
    op.add_column("campaigns", sa.Column("bcc", sa.String(length=512), nullable=True))
    op.add_column(
        "campaigns",
        sa.Column(
            "sending_priority",
            sa.String(length=32),
            nullable=False,
            server_default="balanced",
        ),
    )
    op.add_column("campaigns", sa.Column("deal_value", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("campaigns", "deal_value")
    op.drop_column("campaigns", "sending_priority")
    op.drop_column("campaigns", "bcc")
    op.drop_column("campaigns", "cc")
    op.drop_column("campaigns", "same_thread")
    op.drop_column("campaigns", "text_only")
    op.drop_column("campaigns", "track_clicks")
    op.drop_column("campaigns", "stop_on_reply")
