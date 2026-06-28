from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.crm import CompanyRow, PeopleResponse, PersonRow
from app.services import crm as svc

router = APIRouter(tags=["crm"])


@router.get("/companies", response_model=list[CompanyRow])
async def list_companies(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CompanyRow]:
    rows = await svc.list_companies_for_user(db, current.id)
    return [CompanyRow(**r) for r in rows]


@router.get("/people", response_model=PeopleResponse)
async def list_people(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PeopleResponse:
    rows = await svc.list_people_for_user(
        db, current.id, limit=limit, offset=offset, q=q
    )
    total = await svc.count_people_for_user(db, current.id, q=q)
    return PeopleResponse(
        total=total,
        items=[PersonRow(**r) for r in rows],
    )
