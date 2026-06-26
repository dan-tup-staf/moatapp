from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.campaign import Campaign
from app.models.campaign_group import CampaignGroup
from app.models.user import User
from app.schemas.campaign_groups import GroupCreate, GroupRead, GroupUpdate

router = APIRouter(prefix="/campaign-groups", tags=["campaign-groups"])


def _read(g: CampaignGroup, sequences_count: int) -> GroupRead:
    return GroupRead(
        id=g.id,
        name=g.name,
        created_at=g.created_at,
        sequences_count=sequences_count,
    )


async def _owned(db: AsyncSession, user: User, group_id: int) -> CampaignGroup:
    res = await db.execute(
        select(CampaignGroup).where(
            CampaignGroup.id == group_id, CampaignGroup.user_id == user.id
        )
    )
    obj = res.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Kampania nie znaleziona")
    return obj


@router.get("", response_model=list[GroupRead])
async def list_groups(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupRead]:
    counts_sq = (
        select(Campaign.group_id, func.count(Campaign.id).label("c"))
        .group_by(Campaign.group_id)
        .subquery()
    )
    stmt = (
        select(CampaignGroup, func.coalesce(counts_sq.c.c, 0))
        .outerjoin(counts_sq, counts_sq.c.group_id == CampaignGroup.id)
        .where(CampaignGroup.user_id == current.id)
        .order_by(CampaignGroup.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [_read(g, int(c)) for g, c in rows]


@router.post("", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: GroupCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupRead:
    obj = CampaignGroup(user_id=current.id, name=payload.name)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return _read(obj, 0)


@router.patch("/{group_id}", response_model=GroupRead)
async def update_group(
    group_id: int,
    payload: GroupUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupRead:
    obj = await _owned(db, current, group_id)
    if payload.name is not None:
        obj.name = payload.name
    await db.commit()
    await db.refresh(obj)
    return _read(obj, 0)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    obj = await _owned(db, current, group_id)
    await db.delete(obj)
    await db.commit()
