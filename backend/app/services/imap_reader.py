"""Reply detection via IMAP.

For every connected mailbox that has IMAP configured, we scan the INBOX for
recent messages and, when the sender matches a lead with an active enrollment
in a campaign sending from that mailbox, mark the enrollment as `replied` and
stop its follow-ups (a replied enrollment is skipped by the sender).

imaplib is synchronous, so each mailbox scan runs in a worker thread. No extra
dependency — stdlib only.
"""

import asyncio
import email
import imaplib
import logging
import re
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.email_account import EmailAccount
from app.models.lead import Lead
from app.services.crypto import decrypt

logger = logging.getLogger(__name__)

# Auto-pause a mailbox when a single scan surfaces this many hard bounces.
_BOUNCE_PAUSE_THRESHOLD = 5

_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


def _imap_since(dt: datetime) -> str:
    return f"{dt.day:02d}-{_MONTHS[dt.month - 1]}-{dt.year}"


_BOUNCE_FROM = ("mailer-daemon", "postmaster", "mail delivery", "maildelivery")
_BOUNCE_SUBJECT = (
    "undeliverable",
    "delivery status notification",
    "mail delivery failed",
    "failure notice",
    "returned mail",
    "delivery failure",
    "nie dostarczono",
)
_FINAL_RE = re.compile(
    r"Final-Recipient:\s*rfc822;\s*([^\s]+)", re.IGNORECASE
)
_ORIG_RE = re.compile(
    r"Original-Recipient:\s*rfc822;\s*([^\s]+)", re.IGNORECASE
)
_STATUS_RE = re.compile(r"Status:\s*(\d)\.\d+\.\d+", re.IGNORECASE)


def _looks_like_bounce(from_addr: str, subject: str) -> bool:
    f = from_addr.lower()
    s = subject.lower()
    return any(k in f for k in _BOUNCE_FROM) or any(
        k in s for k in _BOUNCE_SUBJECT
    )


def _parse_hard_bounces(raw: bytes) -> set[str]:
    """Extract hard-bounced (5.x.x) recipient addresses from a DSN message."""
    out: set[str] = set()
    try:
        msg = email.message_from_bytes(raw)
    except Exception:  # noqa: BLE001
        return out

    # X-Failed-Recipients header is the simplest signal when present.
    for v in msg.get_all("X-Failed-Recipients") or []:
        for _, addr in [parseaddr(p) for p in v.split(",")]:
            if addr:
                out.add(addr.strip().lower())

    text = ""
    for part in msg.walk():
        ctype = part.get_content_type()
        if ctype in ("message/delivery-status", "text/plain"):
            try:
                payload = part.get_payload(decode=True)
                if payload:
                    text += payload.decode("utf-8", "ignore") + "\n"
            except Exception:  # noqa: BLE001
                continue

    # Pair Final/Original-Recipient with a 5.x.x status when we can; otherwise
    # accept the recipient if any 5.x.x status appears in the report.
    has_hard = bool(_STATUS_RE.search(text)) and any(
        m.group(1) == "5" for m in _STATUS_RE.finditer(text)
    )
    for rx in (_FINAL_RE, _ORIG_RE):
        for m in rx.finditer(text):
            if has_hard:
                out.add(m.group(1).strip().strip("<>").lower())
    return out


def _scan_inbox(host: str, port: int, user: str, password: str,
                since: datetime) -> tuple[set[str], set[str]]:
    """Blocking IMAP scan — returns (reply_senders, hard_bounced_recipients)
    seen in INBOX since `since`. Runs in a thread."""
    replies: set[str] = set()
    bounces: set[str] = set()
    conn = imaplib.IMAP4_SSL(host, port)
    try:
        conn.login(user, password)
        conn.select("INBOX", readonly=True)
        typ, data = conn.search(None, "SINCE", _imap_since(since))
        if typ != "OK" or not data or not data[0]:
            return replies, bounces
        ids = data[0].split()
        # Cap the scan so a huge inbox can't stall a tick.
        for num in ids[-300:]:
            typ, msg_data = conn.fetch(
                num, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])"
            )
            if typ != "OK" or not msg_data:
                continue
            hdr = None
            for part in msg_data:
                if isinstance(part, tuple) and part[1]:
                    hdr = email.message_from_bytes(part[1])
                    break
            if hdr is None:
                continue
            _, addr = parseaddr(hdr.get("From", ""))
            subject = str(hdr.get("Subject", ""))
            if _looks_like_bounce(addr or "", subject):
                # Fetch the full DSN to pull the failed recipient(s).
                typ2, full = conn.fetch(num, "(BODY.PEEK[])")
                if typ2 == "OK" and full:
                    for fp in full:
                        if isinstance(fp, tuple) and fp[1]:
                            bounces |= _parse_hard_bounces(fp[1])
            elif addr:
                replies.add(addr.strip().lower())
    finally:
        try:
            conn.logout()
        except Exception:  # noqa: BLE001
            pass
    return replies, bounces


async def poll_account_replies(db: AsyncSession, account: EmailAccount) -> int:
    """Scan one mailbox and mark matching active enrollments as replied.
    Returns the number of enrollments transitioned."""
    if not account.imap_host:
        return 0
    password = decrypt(account.smtp_password_enc)
    user = account.smtp_username or account.email
    if not password:
        return 0

    since = account.last_reply_check_at or (
        datetime.now(timezone.utc) - timedelta(days=3)
    )
    try:
        replies, bounces = await asyncio.to_thread(
            _scan_inbox,
            account.imap_host,
            account.imap_port or 993,
            user,
            password,
            since,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("IMAP scan failed for %s: %s", account.email, e)
        account.last_error = f"IMAP: {type(e).__name__}: {e}"[:1000]
        await db.commit()
        return 0

    transitioned = 0
    if replies:
        rows = (
            await db.execute(
                select(CampaignEnrollment, Lead)
                .join(Lead, CampaignEnrollment.lead_id == Lead.id)
                .join(Campaign, CampaignEnrollment.campaign_id == Campaign.id)
                .where(
                    Campaign.user_id == account.user_id,
                    func.lower(Campaign.from_email) == account.email.lower(),
                    CampaignEnrollment.status == "active",
                    func.lower(Lead.email).in_(list(replies)),
                )
            )
        ).all()
        for enr, lead in rows:
            enr.status = "replied"
            enr.next_send_at = None
            if lead.status not in ("unsubscribed", "bounced"):
                lead.status = "replied"
            transitioned += 1

    bounced_now = 0
    if bounces:
        # Hard bounce → stop the enrollment and flag the lead so we never email
        # that address again (across all campaigns).
        rows = (
            await db.execute(
                select(CampaignEnrollment, Lead)
                .join(Lead, CampaignEnrollment.lead_id == Lead.id)
                .join(Campaign, CampaignEnrollment.campaign_id == Campaign.id)
                .where(
                    Campaign.user_id == account.user_id,
                    CampaignEnrollment.status == "active",
                    func.lower(Lead.email).in_(list(bounces)),
                )
            )
        ).all()
        for enr, lead in rows:
            enr.status = "bounced"
            enr.next_send_at = None
            lead.status = "bounced"
            bounced_now += 1

    # Deliverability guard: too many fresh bounces from this mailbox → pause it
    # so we stop torching the domain reputation until the user cleans the list.
    if bounced_now >= _BOUNCE_PAUSE_THRESHOLD and account.active:
        account.active = False
        account.last_error = (
            f"Wstrzymano automatycznie: {bounced_now} twardych odbić w jednym "
            "skanie. Wyczyść listę i włącz skrzynkę ponownie."
        )

    account.last_reply_check_at = datetime.now(timezone.utc)
    await db.commit()
    return transitioned + bounced_now


async def poll_all_replies() -> int:
    """Scan every connected mailbox with IMAP configured. Returns total
    enrollments marked replied."""
    async with AsyncSessionLocal() as db:
        ids = [
            r[0]
            for r in (
                await db.execute(
                    select(EmailAccount.id).where(
                        EmailAccount.active.is_(True),
                        EmailAccount.imap_host.isnot(None),
                    )
                )
            ).all()
        ]

    total = 0
    for aid in ids:
        async with AsyncSessionLocal() as db:
            acc = (
                await db.execute(
                    select(EmailAccount).where(EmailAccount.id == aid)
                )
            ).scalar_one_or_none()
            if acc is None:
                continue
            try:
                total += await poll_account_replies(db, acc)
            except Exception:  # noqa: BLE001
                logger.exception("poll_all_replies: account %s failed", aid)
    return total
