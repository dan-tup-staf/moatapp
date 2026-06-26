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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.lead import Lead
from app.models.message import Message
from app.models.sequence_step import SequenceStep
from app.services.campaigns import list_variants, pick_variant, render_template
from app.services.icp import get_or_none as _get_icp
from app.services.icp import merge_tags as _icp_merge_tags
from app.services.tracking import open_pixel_url

logger = logging.getLogger(__name__)

_DEFAULT_UNSUB = (
    "Jeśli nie chcesz otrzymywać kolejnych wiadomości, odpisz STOP."
)


def _allowed_days(send_days: str | None) -> set[int]:
    out = {int(p) for p in (send_days or "").split(",") if p.strip().isdigit()}
    return out or {1, 2, 3, 4, 5, 6, 7}


def _within_window(
    now: datetime, start_h: int, end_h: int, days: set[int]
) -> bool:
    if now.isoweekday() not in days:
        return False
    return start_h <= now.hour < end_h


def _next_window_open(
    now: datetime, start_h: int, end_h: int, days: set[int]
) -> datetime:
    cand = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    for _ in range(24 * 14):
        if _within_window(cand, start_h, end_h, days):
            return cand
        cand += timedelta(hours=1)
    return now + timedelta(hours=1)


def smtp_configured() -> bool:
    """True when a real (non-Mailhog) sending mailbox looks configured."""
    return bool(settings.smtp_username and settings.smtp_password)


def _to_html(body: str, pixel_url: str) -> str:
    import html as _html

    esc = _html.escape(body).replace("\n", "<br>\n")
    return (
        f"<html><body>{esc}"
        f'<img src="{pixel_url}" width="1" height="1" alt="" '
        f'style="display:none">'
        f"</body></html>"
    )


async def _send_via_smtp(
    *,
    to_email: str,
    from_email: str,
    from_name: str | None,
    subject: str,
    body: str,
    html: str | None = None,
) -> None:
    # Prefer the authenticated mailbox address as the From — many providers
    # reject a From that doesn't match the logged-in account.
    actual_from = settings.smtp_from_email or from_email
    actual_name = from_name or settings.smtp_from_name or None

    msg = EmailMessage()
    msg["From"] = f"{actual_name} <{actual_from}>" if actual_name else actual_from
    msg["To"] = to_email
    msg["Subject"] = subject
    # Lightweight unsubscribe header (improves deliverability). Token-based
    # one-click handling is a later milestone.
    msg["List-Unsubscribe"] = f"<mailto:{actual_from}?subject=unsubscribe>"
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username or None,
        password=settings.smtp_password or None,
        use_tls=settings.smtp_use_tls,
        start_tls=settings.smtp_starttls or None,
    )


async def send_test_email(to_email: str) -> None:
    """Send a one-off test message via the configured SMTP. Raises on failure."""
    await _send_via_smtp(
        to_email=to_email,
        from_email=settings.smtp_from_email or "no-reply@moation.local",
        from_name=settings.smtp_from_name or "MOATION",
        subject="MOATION — test wysyłki ✅",
        body=(
            "To jest testowa wiadomość z MOATION.\n\n"
            "Jeśli ją widzisz, Twoja skrzynka wysyłkowa jest poprawnie "
            "skonfigurowana i możesz wysyłać kampanie.\n"
        ),
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

    # Non-email channels (LinkedIn visit/invite/message) are visual-only for
    # MVP — we record nothing and just advance the enrollment so the sequence
    # doesn't get stuck. User handles LinkedIn manually via the UI.
    if step.channel != "email":
        msg = None
    else:
        # Respect the campaign sending window — if outside it, defer this
        # enrollment to the next open slot instead of sending now.
        now2 = datetime.now(timezone.utc)
        days = _allowed_days(campaign.send_days)
        if not _within_window(
            now2,
            campaign.send_window_start_hour,
            campaign.send_window_end_hour,
            days,
        ):
            enr.next_send_at = _next_window_open(
                now2,
                campaign.send_window_start_hour,
                campaign.send_window_end_hour,
                days,
            )
            await db.commit()
            return None

        # A/B variants: the step itself is variant "A"; pick one per recipient.
        variants = await list_variants(db, step.id)
        options = [(step.subject, step.body_template)] + [
            (v.subject, v.body_template) for v in variants
        ]
        chosen_subject, chosen_body = pick_variant(
            options, f"{lead.email}|{step.id}"
        )
        icp = await _get_icp(db, campaign.user_id)
        extra = _icp_merge_tags(icp.icp_fields if icp else None)
        subject = render_template(chosen_subject, lead, extra)
        body = render_template(chosen_body, lead, extra)
        if campaign.include_unsubscribe:
            footer = (campaign.unsubscribe_text or _DEFAULT_UNSUB).strip()
            if footer:
                body = f"{body}\n\n---\n{footer}"

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
        await db.flush()  # assign msg.id for the tracking pixel

        html = None
        if campaign.track_opens:
            pixel = open_pixel_url(msg.id)
            if pixel:
                html = _to_html(body, pixel)

        try:
            await _send_via_smtp(
                to_email=lead.email,
                from_email=campaign.from_email,
                from_name=campaign.from_name,
                subject=subject,
                body=body,
                html=html,
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
    if msg is not None:
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

        # Daily safety cap on outbound email (deliverability / cold-start).
        limit = settings.smtp_daily_limit
        if limit and limit > 0 and enrollment_ids:
            day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            sent_today = int(
                (
                    await db.execute(
                        select(func.count())
                        .select_from(Message)
                        .where(
                            Message.status == "sent",
                            Message.sent_at.isnot(None),
                            Message.sent_at >= day_start,
                        )
                    )
                ).scalar()
                or 0
            )
            remaining = limit - sent_today
            if remaining <= 0:
                logger.warning(
                    "Dzienny limit maili (%d) osiągnięty — wstrzymuję wysyłkę",
                    limit,
                )
                return 0
            enrollment_ids = enrollment_ids[:remaining]

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
