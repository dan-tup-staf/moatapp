"""Email send pipeline.

Reads due `CampaignEnrollment` rows, renders the next sequence step for the
associated lead, ships the message via SMTP (Mailhog in dev), records a
`Message` row, and advances the enrollment to the next step.

NOTE: not crash-safe — if the worker dies between SMTP send and DB commit, the
same email may be sent twice on the next tick. Acceptable for MVP, revisit
with a SELECT FOR UPDATE SKIP LOCKED lease pattern when we add concurrency.
"""

import logging
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import aiosmtplib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.lead import Lead
from app.models.message import Message
from app.models.sequence_step import SequenceStep
from app.services.campaigns import render_template

logger = logging.getLogger(__name__)


async def _send_via_smtp(
    *,
    to_email: str,
    from_email: str,
    from_name: str | None,
    subject: str,
    body: str,
) -> None:
    msg = EmailMessage()
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
    )


async def _process_one(db: AsyncSession, enrollment_id: int) -> Message | None:
    """Process a single enrollment by id. Returns Message or None if skipped."""
    enr = (
        await db.execute(
            select(CampaignEnrollment).where(CampaignEnrollment.id == enrollment_id)
        )
    ).scalar_one_or_none()
    if enr is None or enr.status != "active":
        return None

    campaign = (
        await db.execute(select(Campaign).where(Campaign.id == enr.campaign_id))
    ).scalar_one_or_none()
    if campaign is None or campaign.status != "active":
        return None

    lead = (
        await db.execute(select(Lead).where(Lead.id == enr.lead_id))
    ).scalar_one_or_none()
    if lead is None:
        return None

    steps = list(
        (
            await db.execute(
                select(SequenceStep)
                .where(SequenceStep.campaign_id == campaign.id)
                .order_by(SequenceStep.step_order.asc(), SequenceStep.id.asc())
            )
        )
        .scalars()
        .all()
    )
    if enr.current_step >= len(steps):
        # Already past the last step — mark completed and stop.
        enr.status = "completed"
        enr.next_send_at = None
        await db.commit()
        return None

    step = steps[enr.current_step]
    subject = render_template(step.subject, lead)
    body = render_template(step.body_template, lead)

    msg = Message(
        enrollment_id=enr.id,
        step_id=step.id,
        subject=subject,
        body=body,
        to_email=lead.email,
        from_email=campaign.from_email,
        status="sent",
    )
    db.add(msg)

    try:
        await _send_via_smtp(
            to_email=lead.email,
            from_email=campaign.from_email,
            from_name=campaign.from_name,
            subject=subject,
            body=body,
        )
        msg.sent_at = datetime.now(timezone.utc)
        msg.status = "sent"
        if lead.status == "new":
            lead.status = "contacted"
    except Exception as e:
        logger.exception("SMTP send failed for enrollment %s", enr.id)
        msg.status = "failed"
        msg.error = str(e)[:1000]

    # Advance to the next step (or mark completed)
    next_idx = enr.current_step + 1
    if next_idx >= len(steps):
        enr.status = "completed"
        enr.next_send_at = None
    else:
        next_step = steps[next_idx]
        enr.next_send_at = datetime.now(timezone.utc) + timedelta(
            days=next_step.delay_days
        )
    enr.current_step = next_idx

    await db.commit()
    await db.refresh(msg)
    return msg


async def process_due_enrollments(campaign_id: int | None = None) -> int:
    """Find active enrollments with next_send_at <= now() and process them.

    If `campaign_id` is given, restrict to that campaign (used by the manual
    "send due now" trigger). Returns the number of messages successfully
    processed (sent or failed-but-recorded)."""
    now = datetime.now(timezone.utc)

    # First pass — collect ids in a short-lived session, then process each in
    # its own session so a bad row doesn't poison the rest.
    async with AsyncSessionLocal() as db:
        stmt = select(CampaignEnrollment.id).where(
            CampaignEnrollment.status == "active",
            CampaignEnrollment.next_send_at.isnot(None),
            CampaignEnrollment.next_send_at <= now,
        )
        if campaign_id is not None:
            stmt = stmt.where(CampaignEnrollment.campaign_id == campaign_id)
        result = await db.execute(stmt)
        enrollment_ids = [row[0] for row in result.all()]

    processed = 0
    for eid in enrollment_ids:
        async with AsyncSessionLocal() as db:
            try:
                msg = await _process_one(db, eid)
                if msg is not None:
                    processed += 1
            except Exception:
                logger.exception("Unhandled error processing enrollment %s", eid)
                continue

    return processed
