"""icp_profiles table

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "icp_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("scraped_summary", sa.Text(), nullable=True),
        sa.Column("qa_history", JSONB(), nullable=False, server_default="[]"),
        sa.Column("icp_fields", JSONB(), nullable=False, server_default="{}"),
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
        sa.UniqueConstraint("user_id", name="uq_icp_user"),
    )
    op.create_index("ix_icp_profiles_user_id", "icp_profiles", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_icp_profiles_user_id", table_name="icp_profiles")
    op.drop_table("icp_profiles")
