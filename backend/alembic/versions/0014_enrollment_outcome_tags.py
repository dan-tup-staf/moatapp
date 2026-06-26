"""campaign_enrollments.outcome + tags (prospects view)

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "campaign_enrollments",
        sa.Column("outcome", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "campaign_enrollments",
        sa.Column(
            "tags",
            sa.String(length=512),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    op.drop_column("campaign_enrollments", "tags")
    op.drop_column("campaign_enrollments", "outcome")
