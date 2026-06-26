"""campaign sending window + unsubscribe settings

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column(
            "send_window_start_hour",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "send_window_end_hour",
            sa.Integer(),
            nullable=False,
            server_default="24",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "send_days",
            sa.String(length=32),
            nullable=False,
            server_default="1,2,3,4,5,6,7",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "include_unsubscribe",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column("unsubscribe_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("campaigns", "unsubscribe_text")
    op.drop_column("campaigns", "include_unsubscribe")
    op.drop_column("campaigns", "send_days")
    op.drop_column("campaigns", "send_window_end_hour")
    op.drop_column("campaigns", "send_window_start_hour")
