from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.domain import Domain
from app.models.user import User
from app.schemas.domains import DomainCreate, DomainHealth, DomainRead
from app.services.domain_health import check_domain, normalize_domain

router = APIRouter(prefix="/domains", tags=["domains"])


@router.get("", response_model=list[DomainRead])
async def list_domains(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Domain]:
    res = await db.execute(
        select(Domain)
        .where(Domain.user_id == current.id)
        .order_by(Domain.created_at.desc())
    )
    return list(res.scalars().all())


@router.post("", response_model=DomainRead, status_code=status.HTTP_201_CREATED)
async def add_domain(
    payload: DomainCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Domain:
    name = normalize_domain(payload.domain)
    if not name or "." not in name:
        raise HTTPException(
            status_code=400, detail="Podaj poprawną domenę (np. twojafirma.pl)"
        )
    existing = await db.execute(
        select(Domain).where(Domain.user_id == current.id, Domain.domain == name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ta domena już jest dodana")
    obj = Domain(user_id=current.id, domain=name)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_domain(
    domain_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    res = await db.execute(
        select(Domain).where(Domain.id == domain_id, Domain.user_id == current.id)
    )
    obj = res.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono domeny")
    await db.delete(obj)
    await db.commit()


@router.get("/check", response_model=DomainHealth)
async def check_adhoc(
    domain: str = Query(..., min_length=3),
    current: User = Depends(get_current_user),
) -> dict:
    """Ad-hoc health check for a domain without saving it."""
    return await check_domain(domain)


@router.get("/{domain_id}/health", response_model=DomainHealth)
async def domain_health(
    domain_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    res = await db.execute(
        select(Domain).where(Domain.id == domain_id, Domain.user_id == current.id)
    )
    obj = res.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono domeny")
    return await check_domain(obj.domain)
