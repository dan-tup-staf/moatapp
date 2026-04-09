from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.leads import LeadListCreate, LeadListRead, LeadListUpdate
from app.services import leads as leads_service

router = APIRouter(prefix="/lists", tags=["lists"])


def _to_read(lead_list, leads_count: int) -> LeadListRead:
    return LeadListRead(
        id=lead_list.id,
        name=lead_list.name,
        description=lead_list.description,
        created_at=lead_list.created_at,
        leads_count=leads_count,
    )


@router.get("", response_model=list[LeadListRead])
async def list_all(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LeadListRead]:
    rows = await leads_service.list_lists_with_counts(db, current.id)
    return [_to_read(ll, count) for ll, count in rows]


@router.post("", response_model=LeadListRead, status_code=status.HTTP_201_CREATED)
async def create_one(
    payload: LeadListCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeadListRead:
    obj = await leads_service.create_list(db, current.id, payload)
    return _to_read(obj, 0)


@router.get("/{list_id}", response_model=LeadListRead)
async def get_one(
    list_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeadListRead:
    obj = await leads_service.get_list(db, current.id, list_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="List not found")
    count = await leads_service.count_leads(db, obj.id)
    return _to_read(obj, count)


@router.patch("/{list_id}", response_model=LeadListRead)
async def update_one(
    list_id: int,
    payload: LeadListUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeadListRead:
    obj = await leads_service.get_list(db, current.id, list_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="List not found")
    obj = await leads_service.update_list(db, obj, payload)
    count = await leads_service.count_leads(db, obj.id)
    return _to_read(obj, count)


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    list_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    obj = await leads_service.get_list(db, current.id, list_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="List not found")
    await leads_service.delete_list(db, obj)
