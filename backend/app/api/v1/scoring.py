from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.scoring_config import ScoringConfig
from app.models.user import User

router = APIRouter(prefix="/scoring", tags=["scoring"])


class ScoringRead(BaseModel):
    tier1_min: int
    tier2_min: int


class ScoringUpdate(BaseModel):
    tier1_min: int = Field(ge=1, le=100000)
    tier2_min: int = Field(ge=1, le=100000)


async def _get_or_create(db: AsyncSession, user_id: int) -> ScoringConfig:
    cfg = (
        await db.execute(
            select(ScoringConfig).where(ScoringConfig.user_id == user_id)
        )
    ).scalar_one_or_none()
    if cfg is None:
        cfg = ScoringConfig(user_id=user_id, tier1_min=100, tier2_min=20)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


@router.get("", response_model=ScoringRead)
async def get_scoring(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScoringRead:
    cfg = await _get_or_create(db, current.id)
    return ScoringRead(tier1_min=cfg.tier1_min, tier2_min=cfg.tier2_min)


@router.put("", response_model=ScoringRead)
async def update_scoring(
    payload: ScoringUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScoringRead:
    if payload.tier2_min >= payload.tier1_min:
        raise HTTPException(
            status_code=400,
            detail="Próg Tier 1 musi być wyższy niż próg Tier 2.",
        )
    cfg = await _get_or_create(db, current.id)
    cfg.tier1_min = payload.tier1_min
    cfg.tier2_min = payload.tier2_min
    await db.commit()
    await db.refresh(cfg)
    return ScoringRead(tier1_min=cfg.tier1_min, tier2_min=cfg.tier2_min)
