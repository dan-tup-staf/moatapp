from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.inbox import InboxMessage, ReadRequest, ReplyRequest
from app.services import inbox as svc

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("", response_model=list[InboxMessage])
async def list_inbox(
    unread_only: bool = False,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InboxMessage]:
    rows = await svc.list_inbox(db, current.id, unread_only=unread_only)
    return [InboxMessage(**r) for r in rows]


@router.get("/unread-count", response_model=int)
async def unread_count(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> int:
    return await svc.unread_count(db, current.id)


@router.post("/{message_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    message_id: int,
    payload: ReadRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await svc.mark_read(db, current.id, message_id, payload.read)


@router.post("/{message_id}/reply", status_code=status.HTTP_204_NO_CONTENT)
async def reply(
    message_id: int,
    payload: ReplyRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    msg = await svc.get_message(db, current.id, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono wiadomości")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Pusta treść odpowiedzi")
    try:
        await svc.reply(db, current.id, msg, payload.body)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)[:500]) from e
