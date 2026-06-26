"""campaign_groups (umbrella) + campaigns.group_id

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campaign_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_campaign_groups_user_id", "campaign_groups", ["user_id"]
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("campaign_groups.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("campaigns", "group_id")
    op.drop_index("ix_campaign_groups_user_id", table_name="campaign_groups")
    op.drop_table("campaign_groups")
