"""crm integrations + sequence goal fields

Revision ID: 0033
Revises: 0032
Create Date: 2026-06-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "crm_integrations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("api_key_enc", sa.Text(), nullable=True),
        sa.Column(
            "extra", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default="true"
        ),
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

    op.add_column(
        "campaigns",
        sa.Column(
            "goal_type", sa.String(length=32), nullable=False, server_default="none"
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "goal_crm_action",
            sa.String(length=16),
            nullable=False,
            server_default="none",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column("goal_crm_provider", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "campaigns", sa.Column("goal_task_note", sa.Text(), nullable=True)
    )
    op.add_column(
        "campaigns", sa.Column("goal_deal_value", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("campaigns", "goal_deal_value")
    op.drop_column("campaigns", "goal_task_note")
    op.drop_column("campaigns", "goal_crm_provider")
    op.drop_column("campaigns", "goal_crm_action")
    op.drop_column("campaigns", "goal_type")
    op.drop_table("crm_integrations")
