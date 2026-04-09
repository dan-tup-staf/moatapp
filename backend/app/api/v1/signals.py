from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.signals import SignalRead
from app.services import signals as svc

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("", response_model=list[SignalRead])
async def list_feed(
    limit: int = 100,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SignalRead]:
    rows = await svc.list_signals_for_user(db, current.id, limit=limit)
    out: list[SignalRead] = []
    for sig, source, lead in rows:
        item = SignalRead.model_validate(sig)
        item.source_name = source.name
        item.lead_email = lead.email if lead is not None else None
        out.append(item)
    return out


@router.delete("/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    signal_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    obj = await svc.get_signal(db, current.id, signal_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    await svc.delete_signal(db, obj)
