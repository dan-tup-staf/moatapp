from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.leads import (
    CsvImportResult,
    LeadCreate,
    LeadRead,
    LeadUpdate,
)
from app.services import leads as leads_service

router = APIRouter(prefix="/lists/{list_id}/leads", tags=["leads"])


async def _ensure_owned_list(
    db: AsyncSession, current: User, list_id: int
):
    obj = await leads_service.get_list(db, current.id, list_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="List not found")
    return obj


@router.get("", response_model=list[LeadRead])
async def list_leads(
    list_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LeadRead]:
    await _ensure_owned_list(db, current, list_id)
    leads = await leads_service.list_leads_for_list(db, list_id)
    return [LeadRead.model_validate(l) for l in leads]


@router.post("", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
async def create_lead(
    list_id: int,
    payload: LeadCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeadRead:
    await _ensure_owned_list(db, current, list_id)
    obj = await leads_service.create_lead(db, list_id, payload)
    return LeadRead.model_validate(obj)


@router.post("/import", response_model=CsvImportResult)
async def import_leads_csv(
    list_id: int,
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CsvImportResult:
    await _ensure_owned_list(db, current, list_id)
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from None
    return await leads_service.import_csv(db, list_id, text)


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    list_id: int,
    lead_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeadRead:
    await _ensure_owned_list(db, current, list_id)
    obj = await leads_service.get_lead(db, list_id, lead_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadRead.model_validate(obj)


@router.patch("/{lead_id}", response_model=LeadRead)
async def update_lead(
    list_id: int,
    lead_id: int,
    payload: LeadUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LeadRead:
    await _ensure_owned_list(db, current, list_id)
    obj = await leads_service.get_lead(db, list_id, lead_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    obj = await leads_service.update_lead(db, obj, payload)
    return LeadRead.model_validate(obj)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    list_id: int,
    lead_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _ensure_owned_list(db, current, list_id)
    obj = await leads_service.get_lead(db, list_id, lead_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    await leads_service.delete_lead(db, obj)
