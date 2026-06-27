from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.linkedin_accounts import (
    LinkedInAccountCreate,
    LinkedInAccountRead,
    LinkedInAccountUpdate,
    LinkedInTestResult,
)
from app.services import linkedin_accounts as svc

router = APIRouter(prefix="/linkedin-accounts", tags=["linkedin-accounts"])


def _to_read(acc) -> LinkedInAccountRead:
    item = LinkedInAccountRead.model_validate(acc)
    item.has_session = svc.has_session(acc)
    return item


@router.get("", response_model=list[LinkedInAccountRead])
async def list_accounts(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LinkedInAccountRead]:
    return [_to_read(a) for a in await svc.list_accounts(db, current.id)]


@router.post(
    "", response_model=LinkedInAccountRead, status_code=status.HTTP_201_CREATED
)
async def create_account(
    payload: LinkedInAccountCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LinkedInAccountRead:
    acc = await svc.create_account(db, current.id, payload)
    return _to_read(acc)


@router.patch("/{account_id}", response_model=LinkedInAccountRead)
async def update_account(
    account_id: int,
    payload: LinkedInAccountUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LinkedInAccountRead:
    acc = await svc.get_account(db, current.id, account_id)
    if acc is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono konta")
    acc = await svc.update_account(db, acc, payload)
    return _to_read(acc)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    acc = await svc.get_account(db, current.id, account_id)
    if acc is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono konta")
    await svc.delete_account(db, acc)


@router.post("/{account_id}/test", response_model=LinkedInTestResult)
async def test_account(
    account_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LinkedInTestResult:
    acc = await svc.get_account(db, current.id, account_id)
    if acc is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono konta")
    ok, detail = await svc.test_account(db, acc)
    return LinkedInTestResult(ok=ok, detail=detail)
