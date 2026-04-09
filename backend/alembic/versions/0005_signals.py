"""signal_sources + signals tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "signal_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("config", JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "score_weight", sa.Integer(), nullable=False, server_default="5"
        ),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_signal_sources_user_id", "signal_sources", ["user_id"])

    op.create_table(
        "signals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_id",
            sa.Integer(),
            sa.ForeignKey("signal_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lead_id",
            sa.Integer(),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("company_domain", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("payload", JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "score_weight", sa.Integer(), nullable=False, server_default="5"
        ),
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("source_id", "url", name="uq_signal_source_url"),
    )
    op.create_index("ix_signals_source_id", "signals", ["source_id"])
    op.create_index("ix_signals_lead_id", "signals", ["lead_id"])
    op.create_index(
        "ix_signals_company_domain", "signals", ["company_domain"]
    )


def downgrade() -> None:
    op.drop_index("ix_signals_company_domain", table_name="signals")
    op.drop_index("ix_signals_lead_id", table_name="signals")
    op.drop_index("ix_signals_source_id", table_name="signals")
    op.drop_table("signals")
    op.drop_index("ix_signal_sources_user_id", table_name="signal_sources")
    op.drop_table("signal_sources")
