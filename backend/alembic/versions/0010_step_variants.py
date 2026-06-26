"""sequence_step_variants table

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sequence_step_variants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "step_id",
            sa.Integer(),
            sa.ForeignKey("sequence_steps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body_template", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_sequence_step_variants_step_id",
        "sequence_step_variants",
        ["step_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sequence_step_variants_step_id",
        table_name="sequence_step_variants",
    )
    op.drop_table("sequence_step_variants")
