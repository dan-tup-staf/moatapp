from fastapi import APIRouter, Depends, Query
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
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    list_id: int | None = Query(default=None),
    company: str | None = Query(default=None),
    campaign_id: int | None = Query(default=None),
    signal_source_id: int | None = Query(default=None),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PersonRow]:
    """Returns a plain array (paginated by limit/offset/q + facet filters).
    Total is a separate endpoint."""
    rows = await svc.list_people_for_user(
        db,
        current.id,
        limit=limit,
        offset=offset,
        q=q,
        list_id=list_id,
        company=company,
        campaign_id=campaign_id,
        signal_source_id=signal_source_id,
    )
    return [PersonRow(**r) for r in rows]


@router.get("/people/count")
async def people_count(
    q: str | None = Query(default=None),
    list_id: int | None = Query(default=None),
    company: str | None = Query(default=None),
    campaign_id: int | None = Query(default=None),
    signal_source_id: int | None = Query(default=None),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return {
        "total": await svc.count_people_for_user(
            db,
            current.id,
            q=q,
            list_id=list_id,
            company=company,
            campaign_id=campaign_id,
            signal_source_id=signal_source_id,
        )
    }
