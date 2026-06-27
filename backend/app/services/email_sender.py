"""Email send pipeline.

Reads due `CampaignEnrollment` rows, renders the next sequence step for the
associated lead, ships the message via SMTP (Mailhog in dev), records a
`Message` row, and advances the enrollment to the next step.

NOTE: not crash-safe — if the worker dies between SMTP send and DB commit, the
same email may be sent twice on the next tick. Acceptable for MVP, revisit
with a SELECT FOR UPDATE SKIP LOCKED lease pattern when we add concurrency.
"""

import html as _html
import logging
import re
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
from app.services.tracking import (
    click_redirect_url,
    open_pixel_url,
    unsubscribe_url,
)

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


# Matches bare http(s) URLs; trailing sentence punctuation is trimmed below so
# "see https://x.com." doesn't capture the period into the link.
_URL_RE = re.compile(r'https?://[^\s<>"\']+')
_URL_TRAILING = ".,;:!?)]}\"'"


def _build_html(
    body: str,
    *,
    message_id: int,
    track_clicks: bool,
    pixel_url: str | None,
) -> str:
    """Render the plain-text body as HTML: escape text, turn bare URLs into
    links (optionally routed through the click-tracker), append the open pixel
    when provided."""
    out: list[str] = []
    last = 0
    for m in _URL_RE.finditer(body):
        url = m.group(0)
        trail = ""
        while url and url[-1] in _URL_TRAILING:
            trail = url[-1] + trail
            url = url[:-1]
        out.append(_html.escape(body[last : m.start()]))
        # Don't route our own tracking/unsubscribe links through the click
        # tracker — that would inflate click stats and double-redirect.
        own = "/api/v1/track/" in url
        href = (
            click_redirect_url(message_id, url)
            if track_clicks and not own
            else None
        ) or url
        out.append(
            f'<a href="{_html.escape(href, quote=True)}">{_html.escape(url)}</a>'
        )
        out.append(_html.escape(trail))
        last = m.end()
    out.append(_html.escape(body[last:]))
    inner = "".join(out).replace("\n", "<br>\n")

    pixel = (
        f'<img src="{_html.escape(pixel_url, quote=True)}" width="1" '
        f'height="1" alt="" style="display:none">'
        if pixel_url
        else ""
    )
    return f"<html><body>{inner}{pixel}</body></html>"


class SmtpCreds:
    """Resolved SMTP transport for a connected EmailAccount."""

    __slots__ = (
        "host",
        "port",
        "username",
        "password",
        "security",
        "from_email",
        "from_name",
    )

    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str | None,
        password: str | None,
        security: str,
        from_email: str,
        from_name: str | None,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.security = security
        self.from_email = from_email
        self.from_name = from_name


def _creds_from_account(acc):
    """Build SmtpCreds from an EmailAccount, or None when it lacks a usable
    SMTP host/password."""
    from app.services.crypto import decrypt

    if acc is None or not acc.smtp_host or not acc.smtp_password_enc:
        return None
    password = decrypt(acc.smtp_password_enc)
    if not password:
        return None
    return SmtpCreds(
        host=acc.smtp_host,
        port=acc.smtp_port or (465 if acc.smtp_security == "ssl" else 587),
        username=acc.smtp_username or acc.email,
        password=password,
        security=acc.smtp_security or "starttls",
        from_email=acc.email,
        from_name=acc.from_name,
    )


async def _resolve_creds(db: AsyncSession, user_id: int, from_email: str):
    """SmtpCreds for the active connected mailbox matching `from_email`, or
    None (caller falls back to env)."""
    from app.models.email_account import EmailAccount

    acc = (
        await db.execute(
            select(EmailAccount).where(
                EmailAccount.user_id == user_id,
                func.lower(EmailAccount.email) == (from_email or "").lower(),
                EmailAccount.active.is_(True),
            )
        )
    ).scalar_one_or_none()
    return _creds_from_account(acc)


async def _resolve_sender(db, campaign, enr):
    """Decide which mailbox sends this prospect's message. When the campaign has
    rotation configured, pick one of its accounts deterministically by
    enrollment id (so a prospect keeps the SAME mailbox across all steps —
    important for thread/deliverability consistency). Returns
    (creds_or_None, from_email, from_name, account_or_None)."""
    from app.models.email_account import EmailAccount

    ids = [
        int(x)
        for x in (campaign.sender_account_ids or "").split(",")
        if x.strip().isdigit()
    ]
    if ids:
        rows = (
            await db.execute(
                select(EmailAccount).where(
                    EmailAccount.id.in_(ids),
                    EmailAccount.user_id == campaign.user_id,
                    EmailAccount.active.is_(True),
                )
            )
        ).scalars().all()
        by_id = {a.id: a for a in rows}
        ordered = [by_id[i] for i in ids if i in by_id]
        if ordered:
            acc = ordered[enr.id % len(ordered)]
            return _creds_from_account(acc), acc.email, acc.from_name, acc

    acc = (
        await db.execute(
            select(EmailAccount).where(
                EmailAccount.user_id == campaign.user_id,
                func.lower(EmailAccount.email)
                == (campaign.from_email or "").lower(),
                EmailAccount.active.is_(True),
            )
        )
    ).scalar_one_or_none()
    return (
        _creds_from_account(acc),
        campaign.from_email,
        campaign.from_name,
        acc,
    )


async def _account_sent_today(db: AsyncSession, email: str) -> int:
    """Count messages already sent today FROM a given mailbox address — for
    per-account daily caps under rotation."""
    day_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return int(
        (
            await db.execute(
                select(func.count())
                .select_from(Message)
                .where(
                    func.lower(Message.from_email) == (email or "").lower(),
                    Message.status == "sent",
                    Message.sent_at.isnot(None),
                    Message.sent_at >= day_start,
                )
            )
        ).scalar()
        or 0
    )


def _split_addrs(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [a.strip() for a in raw.replace(";", ",").split(",") if a.strip()]


# ---------- LinkedIn (Voyager) step delivery ----------


async def _resolve_linkedin(db: AsyncSession, user_id: int):
    """First active, connected LinkedIn account for the user, or None."""
    from app.models.linkedin_account import LinkedInAccount

    return (
        await db.execute(
            select(LinkedInAccount)
            .where(
                LinkedInAccount.user_id == user_id,
                LinkedInAccount.active.is_(True),
            )
            .order_by(LinkedInAccount.id.asc())
        )
    ).scalars().first()


async def _linkedin_sent_today(
    db: AsyncSession, user_id: int, channel: str
) -> int:
    """Count today's successful LinkedIn actions of a given channel for this
    user — used to enforce per-account daily caps."""
    day_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    stmt = (
        select(func.count())
        .select_from(Message)
        .join(SequenceStep, Message.step_id == SequenceStep.id)
        .join(Campaign, SequenceStep.campaign_id == Campaign.id)
        .where(
            Campaign.user_id == user_id,
            SequenceStep.channel == channel,
            Message.status == "sent",
            Message.sent_at.isnot(None),
            Message.sent_at >= day_start,
        )
    )
    return int((await db.execute(stmt)).scalar() or 0)


async def _send_linkedin(db, enr, campaign, lead, step, account, kind: str):
    """Render the step and fire the LinkedIn action via Voyager. Records a
    Message row (channel marked in subject) so per-step stats work."""
    from app.services import linkedin as voyager

    icp = await _get_icp(db, campaign.user_id)
    extra = _icp_merge_tags(icp.icp_fields if icp else None)
    text = render_template(step.body_template, lead, extra)

    msg = Message(
        enrollment_id=enr.id,
        step_id=step.id,
        subject=f"[LinkedIn {kind}]",
        body=text,
        to_email=(lead.email or lead.linkedin_url or "linkedin")[:255],
        from_email=campaign.from_email,
        status="sent",
    )
    db.add(msg)
    await db.flush()

    try:
        if not lead.linkedin_url:
            raise voyager.LinkedInError("Lead nie ma adresu profilu LinkedIn")
        profile = await voyager.resolve_profile(account, lead.linkedin_url)
        urn = profile["member_urn"]
        if kind == "invite":
            await voyager.send_invitation(account, urn, message=text[:300])
        else:
            await voyager.send_message(account, urn, text)
        msg.sent_at = datetime.now(timezone.utc)
        msg.status = "sent"
        if lead.status == "new":
            lead.status = "contacted"
    except Exception as e:  # noqa: BLE001
        logger.exception("LinkedIn %s failed for enrollment %s", kind, enr.id)
        msg.status = "failed"
        msg.error = str(e)[:1000]
    return msg


async def _send_via_smtp(
    *,
    to_email: str,
    from_email: str,
    from_name: str | None,
    subject: str,
    body: str,
    html: str | None = None,
    cc: str | None = None,
    bcc: str | None = None,
    unsub_url: str | None = None,
    creds: "SmtpCreds | None" = None,
) -> None:
    # A connected EmailAccount (creds) wins over the env-configured mailbox.
    # Many providers reject a From that doesn't match the logged-in account, so
    # the From defaults to the authenticated address.
    if creds is not None:
        host = creds.host
        port = creds.port
        username = creds.username or None
        password = creds.password or None
        use_tls = creds.security == "ssl"
        start_tls = True if creds.security == "starttls" else None
        actual_from = creds.from_email or from_email
        actual_name = from_name or creds.from_name or None
    else:
        host = settings.smtp_host
        port = settings.smtp_port
        username = settings.smtp_username or None
        password = settings.smtp_password or None
        use_tls = settings.smtp_use_tls
        start_tls = settings.smtp_starttls or None
        actual_from = settings.smtp_from_email or from_email
        actual_name = from_name or settings.smtp_from_name or None

    msg = EmailMessage()
    msg["From"] = f"{actual_name} <{actual_from}>" if actual_name else actual_from
    msg["To"] = to_email
    cc_list = _split_addrs(cc)
    bcc_list = _split_addrs(bcc)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)
    msg["Subject"] = subject
    # Unsubscribe header (improves deliverability). Prefer a real signed URL
    # with RFC 8058 one-click POST; fall back to mailto when no public base.
    if unsub_url:
        msg["List-Unsubscribe"] = (
            f"<{unsub_url}>, <mailto:{actual_from}?subject=unsubscribe>"
        )
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    else:
        msg["List-Unsubscribe"] = f"<mailto:{actual_from}?subject=unsubscribe>"
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    # Bcc must not appear in headers — pass the full recipient list explicitly
    # so aiosmtplib delivers to To + Cc + Bcc without leaking Bcc.
    recipients = [to_email, *cc_list, *bcc_list]
    await aiosmtplib.send(
        msg,
        recipients=recipients,
        hostname=host,
        port=port,
        username=username,
        password=password,
        use_tls=use_tls,
        start_tls=start_tls,
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


async def send_account_test(account) -> None:
    """Send a test email through a connected EmailAccount's own SMTP creds
    (decrypting its stored password). Sends to the account's own address.
    Raises on any SMTP failure so the caller can record last_error."""
    from app.services.crypto import decrypt

    password = decrypt(account.smtp_password_enc)
    if not account.smtp_host or not password:
        raise RuntimeError("Brak hosta SMTP lub hasła — uzupełnij dane skrzynki")
    creds = SmtpCreds(
        host=account.smtp_host,
        port=account.smtp_port
        or (465 if account.smtp_security == "ssl" else 587),
        username=account.smtp_username or account.email,
        password=password,
        security=account.smtp_security or "starttls",
        from_email=account.email,
        from_name=account.from_name,
    )
    await _send_via_smtp(
        to_email=account.email,
        from_email=account.email,
        from_name=account.from_name,
        subject="MOATION — skrzynka podłączona ✅",
        body=(
            "Gratulacje! Ta skrzynka jest poprawnie podłączona do MOATION i "
            "może wysyłać kampanie.\n\nJeśli widzisz tę wiadomość we własnej "
            "skrzynce, wszystko działa.\n"
        ),
        creds=creds,
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

    # Honour unsubscribes — never email a lead who opted out. Stop their
    # sequence so they're not re-picked every tick.
    if lead.status == "unsubscribed":
        enr.status = "completed"
        enr.next_send_at = None
        await db.commit()
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

    # LinkedIn invite/message steps fire via Voyager when a LinkedIn account is
    # connected; otherwise they stay manual (advance, no record). Other non-email
    # channels (linkedin_visit / call / whatsapp / task) are manual — advance.
    if step.channel in ("linkedin_invite", "linkedin_message"):
        li = await _resolve_linkedin(db, campaign.user_id)
        if li is None:
            msg = None  # no connected account → manual, just advance
        else:
            kind = "invite" if step.channel == "linkedin_invite" else "message"
            limit = (
                li.daily_limit_invites
                if kind == "invite"
                else li.daily_limit_messages
            )
            sent_today = await _linkedin_sent_today(
                db, campaign.user_id, step.channel
            )
            if limit > 0 and sent_today >= limit:
                # Daily cap hit — defer to tomorrow without advancing the step.
                tomorrow = (
                    datetime.now(timezone.utc) + timedelta(days=1)
                ).replace(hour=9, minute=0, second=0, microsecond=0)
                enr.next_send_at = tomorrow
                await db.commit()
                return None
            msg = await _send_linkedin(db, enr, campaign, lead, step, li, kind)
    elif step.channel != "email":
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
        unsub_url = None
        if campaign.include_unsubscribe:
            footer = (campaign.unsubscribe_text or _DEFAULT_UNSUB).strip()
            unsub_url = unsubscribe_url(lead.id)
            parts = [p for p in [footer] if p]
            if unsub_url:
                parts.append(f"Wypisz się jednym kliknięciem: {unsub_url}")
            if parts:
                body = f"{body}\n\n---\n" + "\n".join(parts)

        # Pick the sending mailbox (supports rotation across mailboxes).
        creds, send_from, send_from_name, send_acc = await _resolve_sender(
            db, campaign, enr
        )

        # Per-account daily cap — defer to tomorrow when the chosen mailbox has
        # hit its own limit. During warm-up the effective cap ramps up slowly.
        if send_acc is not None:
            from app.services.email_accounts import effective_daily_limit

            cap = effective_daily_limit(send_acc)
            # Ramp complete → graduate the mailbox to "ready".
            if (
                send_acc.warmup_status == "warming"
                and cap >= send_acc.daily_limit
                and send_acc.daily_limit > 0
            ):
                send_acc.warmup_status = "ready"
            if cap > 0 and await _account_sent_today(db, send_acc.email) >= cap:
                tomorrow = (
                    datetime.now(timezone.utc) + timedelta(days=1)
                ).replace(hour=9, minute=0, second=0, microsecond=0)
                enr.next_send_at = tomorrow
                await db.commit()
                return None

        msg = Message(
            enrollment_id=enr.id,
            step_id=step.id,
            subject=subject,
            body=body,
            to_email=lead.email,
            from_email=send_from,
            status="sent",
        )
        db.add(msg)
        await db.flush()  # assign msg.id for the tracking pixel

        html = None
        # "Send as text only" suppresses the HTML part (better deliverability);
        # open/click tracking need HTML, so text_only wins when both are set.
        if not campaign.text_only and (
            campaign.track_opens or campaign.track_clicks
        ):
            pixel = open_pixel_url(msg.id) if campaign.track_opens else None
            html = _build_html(
                body,
                message_id=msg.id,
                track_clicks=campaign.track_clicks,
                pixel_url=pixel,
            )

        try:
            await _send_via_smtp(
                to_email=lead.email,
                from_email=send_from,
                from_name=send_from_name,
                subject=subject,
                body=body,
                html=html,
                cc=campaign.cc,
                bcc=campaign.bcc,
                unsub_url=unsub_url,
                creds=creds,
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
