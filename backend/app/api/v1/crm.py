from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.crm import CompanyRow, PersonRow
from app.services import crm as svc

router = APIRouter(tags=["crm"])


@router.get("/companies", response_model=list[CompanyRow])
async def list_companies(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CompanyRow]:
    rows = await svc.list_companies_for_user(db, current.id)
    return [CompanyRow(**r) for r in rows]


@router.get("/people", response_model=list[PersonRow])
async def list_people(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PersonRow]:
    rows = await svc.list_people_for_user(db, current.id)
    return [PersonRow(**r) for r in rows]
