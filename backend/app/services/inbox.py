from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_account import EmailAccount
from app.models.inbound_message import InboundMessage
from app.models.lead import Lead


async def list_inbox(
    db: AsyncSession, user_id: int, unread_only: bool = False
) -> list[dict]:
    stmt = (
        select(InboundMessage, Lead)
        .outerjoin(Lead, InboundMessage.lead_id == Lead.id)
        .where(InboundMessage.user_id == user_id)
        .order_by(InboundMessage.received_at.desc().nullslast(), InboundMessage.id.desc())
        .limit(200)
    )
    if unread_only:
        stmt = stmt.where(InboundMessage.is_read.is_(False))
    rows = (await db.execute(stmt)).all()
    out: list[dict] = []
    for m, lead in rows:
        name = None
        company = None
        if lead is not None:
            name = (
                f"{lead.first_name or ''} {lead.last_name or ''}".strip() or None
            )
            company = lead.company
        out.append(
            {
                "id": m.id,
                "from_email": m.from_email,
                "subject": m.subject,
                "body": m.body,
                "received_at": m.received_at,
                "is_read": m.is_read,
                "lead_id": m.lead_id,
                "lead_name": name,
                "lead_company": company,
            }
        )
    return out


async def unread_count(db: AsyncSession, user_id: int) -> int:
    return int(
        (
            await db.execute(
                select(func.count())
                .select_from(InboundMessage)
                .where(
                    InboundMessage.user_id == user_id,
                    InboundMessage.is_read.is_(False),
                )
            )
        ).scalar()
        or 0
    )


async def get_message(
    db: AsyncSession, user_id: int, mid: int
) -> InboundMessage | None:
    return (
        await db.execute(
            select(InboundMessage).where(
                InboundMessage.id == mid, InboundMessage.user_id == user_id
            )
        )
    ).scalar_one_or_none()


async def mark_read(db: AsyncSession, user_id: int, mid: int, read: bool) -> None:
    await db.execute(
        update(InboundMessage)
        .where(
            InboundMessage.id == mid, InboundMessage.user_id == user_id
        )
        .values(is_read=read)
    )
    await db.commit()


async def reply(
    db: AsyncSession, user_id: int, msg: InboundMessage, body: str
) -> None:
    """Send a reply to an inbound message from the mailbox that received it
    (threaded), and mark the message read."""
    from app.services.email_sender import send_direct

    acc = None
    if msg.email_account_id:
        acc = (
            await db.execute(
                select(EmailAccount).where(
                    EmailAccount.id == msg.email_account_id,
                    EmailAccount.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
    if acc is None:
        # Fall back to any active connected mailbox.
        acc = (
            await db.execute(
                select(EmailAccount).where(
                    EmailAccount.user_id == user_id,
                    EmailAccount.active.is_(True),
                )
            )
        ).scalars().first()
    if acc is None:
        raise RuntimeError("Brak podłączonej skrzynki do wysłania odpowiedzi")

    subject = msg.subject or ""
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}".strip()
    await send_direct(acc, msg.from_email, subject, body, msg.message_id)
    msg.is_read = True
    await db.commit()
