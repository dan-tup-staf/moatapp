from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.email_accounts import (
    EmailAccountCreate,
    EmailAccountRead,
    EmailAccountSetup,
    EmailAccountTestResult,
    EmailAccountUpdate,
)
from app.services import email_accounts as svc

router = APIRouter(prefix="/email-accounts", tags=["email-accounts"])


def _to_read(acc) -> EmailAccountRead:
    item = EmailAccountRead.model_validate(acc)
    item.tags = svc.tags_list(acc)
    item.has_password = bool(getattr(acc, "smtp_password_enc", ""))
    return item


@router.get("", response_model=list[EmailAccountRead])
async def list_accounts(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EmailAccountRead]:
    rows = await svc.list_accounts(db, current.id)
    return [_to_read(a) for a in rows]


@router.post(
    "", response_model=EmailAccountRead, status_code=status.HTTP_201_CREATED
)
async def create_account(
    payload: EmailAccountCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailAccountRead:
    existing = await svc.get_by_email(db, current.id, str(payload.email).lower())
    if existing:
        raise HTTPException(status_code=409, detail="Ta skrzynka już jest dodana")
    acc = await svc.create_account(db, current.id, payload)
    return _to_read(acc)


@router.patch("/{account_id}", response_model=EmailAccountRead)
async def update_account(
    account_id: int,
    payload: EmailAccountUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailAccountRead:
    acc = await svc.get_account(db, current.id, account_id)
    if acc is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono skrzynki")
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
        raise HTTPException(status_code=404, detail="Nie znaleziono skrzynki")
    await svc.delete_account(db, acc)


@router.post("/{account_id}/test", response_model=EmailAccountTestResult)
async def test_account(
    account_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailAccountTestResult:
    acc = await svc.get_account(db, current.id, account_id)
    if acc is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono skrzynki")
    ok, detail = await svc.test_account(db, acc)
    return EmailAccountTestResult(ok=ok, detail=detail)


@router.get("/{account_id}/setup", response_model=EmailAccountSetup)
async def account_setup(
    account_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    acc = await svc.get_account(db, current.id, account_id)
    if acc is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono skrzynki")
    return await svc.setup_score(acc)
