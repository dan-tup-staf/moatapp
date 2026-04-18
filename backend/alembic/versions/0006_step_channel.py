"""sequence_steps.channel

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sequence_steps",
        sa.Column(
            "channel",
            sa.String(length=32),
            nullable=False,
            server_default="email",
        ),
    )


def downgrade() -> None:
    op.drop_column("sequence_steps", "channel")
