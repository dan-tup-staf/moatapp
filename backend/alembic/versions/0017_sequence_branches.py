"""sequence_branches (Subsequence — conditional branch rules)

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sequence_branches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "campaign_id",
            sa.Integer(),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "after_step_order", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("condition", sa.String(length=32), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=True),
        sa.Column("tag", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_sequence_branches_campaign_id", "sequence_branches", ["campaign_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sequence_branches_campaign_id", table_name="sequence_branches"
    )
    op.drop_table("sequence_branches")
