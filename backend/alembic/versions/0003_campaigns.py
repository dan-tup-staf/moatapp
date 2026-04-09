"""campaigns + sequence_steps + campaign_enrollments

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="draft"
        ),
        sa.Column("from_email", sa.String(length=255), nullable=False),
        sa.Column("from_name", sa.String(length=255), nullable=True),
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
    op.create_index("ix_campaigns_user_id", "campaigns", ["user_id"])

    op.create_table(
        "sequence_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "campaign_id",
            sa.Integer(),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body_template", sa.Text(), nullable=False),
        sa.Column(
            "delay_days", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.create_index("ix_sequence_steps_campaign_id", "sequence_steps", ["campaign_id"])

    op.create_table(
        "campaign_enrollments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "campaign_id",
            sa.Integer(),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lead_id",
            sa.Integer(),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "current_step", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("next_send_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="active"
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
        sa.UniqueConstraint(
            "campaign_id", "lead_id", name="uq_enrollment_campaign_lead"
        ),
    )
    op.create_index(
        "ix_campaign_enrollments_campaign_id",
        "campaign_enrollments",
        ["campaign_id"],
    )
    op.create_index(
        "ix_campaign_enrollments_lead_id",
        "campaign_enrollments",
        ["lead_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_campaign_enrollments_lead_id", table_name="campaign_enrollments"
    )
    op.drop_index(
        "ix_campaign_enrollments_campaign_id", table_name="campaign_enrollments"
    )
    op.drop_table("campaign_enrollments")
    op.drop_index("ix_sequence_steps_campaign_id", table_name="sequence_steps")
    op.drop_table("sequence_steps")
    op.drop_index("ix_campaigns_user_id", table_name="campaigns")
    op.drop_table("campaigns")
