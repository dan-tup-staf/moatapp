from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.signals import (
    RunResult,
    SignalSourceCreate,
    SignalSourceRead,
    SignalSourceUpdate,
)
from app.services import signals as svc

router = APIRouter(prefix="/signal-sources", tags=["signal-sources"])


def _to_read(source, signals_count: int) -> SignalSourceRead:
    return SignalSourceRead(
        id=source.id,
        name=source.name,
        type=source.type,
        config=source.config,
        enabled=source.enabled,
        score_weight=source.score_weight,
        last_run_at=source.last_run_at,
        last_error=source.last_error,
        created_at=source.created_at,
        signals_count=signals_count,
    )


async def _ensure_owned(db, current, source_id):
    obj = await svc.get_source(db, current.id, source_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Signal source not found")
    return obj


@router.get("", response_model=list[SignalSourceRead])
async def list_all(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SignalSourceRead]:
    rows = await svc.list_sources_with_counts(db, current.id)
    return [_to_read(s, c) for s, c in rows]


@router.post("", response_model=SignalSourceRead, status_code=status.HTTP_201_CREATED)
async def create_one(
    payload: SignalSourceCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SignalSourceRead:
    obj = await svc.create_source(db, current.id, payload)
    return _to_read(obj, 0)


@router.get("/{source_id}", response_model=SignalSourceRead)
async def get_one(
    source_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SignalSourceRead:
    obj = await _ensure_owned(db, current, source_id)
    count = await svc.count_signals(db, obj.id)
    return _to_read(obj, count)


@router.patch("/{source_id}", response_model=SignalSourceRead)
async def update_one(
    source_id: int,
    payload: SignalSourceUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SignalSourceRead:
    obj = await _ensure_owned(db, current, source_id)
    obj = await svc.update_source(db, obj, payload)
    count = await svc.count_signals(db, obj.id)
    return _to_read(obj, count)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    source_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    obj = await _ensure_owned(db, current, source_id)
    await svc.delete_source(db, obj)


@router.post("/{source_id}/run-now", response_model=RunResult)
async def run_now(
    source_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunResult:
    obj = await _ensure_owned(db, current, source_id)
    new_count = await svc.run_source(db, obj)
    return RunResult(new_signals=new_count, error=obj.last_error)
