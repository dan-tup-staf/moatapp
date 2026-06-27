from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.signals import (
    RunAllResult,
    RunResult,
    SignalSourceBatchCreate,
    SignalSourceCreate,
    SignalSourcePreset,
    SignalSourceRead,
    SignalSourceUpdate,
)
from app.services import signals as svc
from app.signal_presets import PRESET_CATEGORIES, list_presets

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


@router.post(
    "/batch",
    response_model=list[SignalSourceRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_batch(
    payload: SignalSourceBatchCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SignalSourceRead]:
    """Activate several sources at once (suggested or preset sources)."""
    if not payload.sources:
        raise HTTPException(status_code=400, detail="Brak źródeł do dodania")
    objs = await svc.create_sources_batch(db, current.id, payload.sources)
    return [_to_read(o, 0) for o in objs]


@router.get("/presets", response_model=list[SignalSourcePreset])
async def list_source_presets(
    current: User = Depends(get_current_user),
) -> list[SignalSourcePreset]:
    """Curated PL-enterprise signal-source templates (registry, regulatory,
    funding, C-suite, expansion). One-click activatable."""
    return [
        SignalSourcePreset(
            key=p["key"],
            category=p["category"],
            category_label=PRESET_CATEGORIES.get(p["category"], p["category"]),
            name=p["name"],
            type=p["type"],
            score_weight=p["score_weight"],
            description=p["description"],
            config=p["config"],
        )
        for p in list_presets()
    ]


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


@router.post("/run-all", response_model=RunAllResult)
async def run_all(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunAllResult:
    """Run every enabled source for the current user and report per-source
    results — the "Uruchom wszystkie" button on the Źródła sygnałów screen."""
    return await svc.run_user_sources(db, current.id)
