from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardStats, HotLeadRead
from app.services import dashboard as svc

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardStats:
    data = await svc.get_stats(db, current.id)
    return DashboardStats(**data)


@router.get("/hot-leads", response_model=list[HotLeadRead])
async def get_hot_leads(
    limit: int = 10,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HotLeadRead]:
    rows = await svc.get_hot_leads(db, current.id, limit=limit)
    out: list[HotLeadRead] = []
    for lead, list_name, signals_count in rows:
        out.append(
            HotLeadRead(
                id=lead.id,
                email=lead.email,
                first_name=lead.first_name,
                last_name=lead.last_name,
                company=lead.company,
                title=lead.title,
                status=lead.status,
                score=lead.score,
                list_id=lead.list_id,
                list_name=list_name,
                signals_count=signals_count,
            )
        )
    return out
