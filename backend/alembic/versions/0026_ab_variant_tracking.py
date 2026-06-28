"""A/B variant tracking + auto-winner

Revision ID: 0026
Revises: 0025
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages", sa.Column("variant_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "sequence_steps",
        sa.Column(
            "ab_auto", sa.Boolean(), nullable=False, server_default="false"
        ),
    )


def downgrade() -> None:
    op.drop_column("sequence_steps", "ab_auto")
    op.drop_column("messages", "variant_id")
