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

_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


def _imap_since(dt: datetime) -> str:
    return f"{dt.day:02d}-{_MONTHS[dt.month - 1]}-{dt.year}"


def _fetch_sender_emails(host: str, port: int, user: str, password: str,
                         since: datetime) -> set[str]:
    """Blocking IMAP scan — returns the set of sender addresses seen in INBOX
    since `since`. Runs in a thread."""
    senders: set[str] = set()
    conn = imaplib.IMAP4_SSL(host, port)
    try:
        conn.login(user, password)
        conn.select("INBOX", readonly=True)
        typ, data = conn.search(None, "SINCE", _imap_since(since))
        if typ != "OK" or not data or not data[0]:
            return senders
        ids = data[0].split()
        # Cap the scan so a huge inbox can't stall a tick.
        for num in ids[-300:]:
            typ, msg_data = conn.fetch(num, "(BODY.PEEK[HEADER.FIELDS (FROM)])")
            if typ != "OK" or not msg_data:
                continue
            for part in msg_data:
                if isinstance(part, tuple) and part[1]:
                    hdr = email.message_from_bytes(part[1])
                    _, addr = parseaddr(hdr.get("From", ""))
                    if addr:
                        senders.add(addr.strip().lower())
    finally:
        try:
            conn.logout()
        except Exception:  # noqa: BLE001
            pass
    return senders


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
        senders = await asyncio.to_thread(
            _fetch_sender_emails,
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
    if senders:
        # Active enrollments for leads whose email replied, in campaigns sending
        # from this mailbox.
        rows = (
            await db.execute(
                select(CampaignEnrollment, Lead)
                .join(Lead, CampaignEnrollment.lead_id == Lead.id)
                .join(Campaign, CampaignEnrollment.campaign_id == Campaign.id)
                .where(
                    Campaign.user_id == account.user_id,
                    func.lower(Campaign.from_email) == account.email.lower(),
                    CampaignEnrollment.status == "active",
                    func.lower(Lead.email).in_(list(senders)),
                )
            )
        ).all()
        for enr, lead in rows:
            enr.status = "replied"
            enr.next_send_at = None
            if lead.status not in ("unsubscribed", "bounced"):
                lead.status = "replied"
            transitioned += 1

    account.last_reply_check_at = datetime.now(timezone.utc)
    await db.commit()
    return transitioned


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
