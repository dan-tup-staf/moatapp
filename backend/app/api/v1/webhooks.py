from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.webhooks import (
    WebhookCreate,
    WebhookRead,
    WebhookTestResult,
)
from app.services import webhooks as svc

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _to_read(h) -> WebhookRead:
    item = WebhookRead.model_validate(h)
    item.events = [e for e in (h.events or "").split(",") if e]
    return item


@router.get("", response_model=list[WebhookRead])
async def list_webhooks(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WebhookRead]:
    return [_to_read(h) for h in await svc.list_hooks(db, current.id)]


@router.get("/events", response_model=list[str])
async def list_events() -> list[str]:
    return svc.EVENTS


@router.post(
    "", response_model=WebhookRead, status_code=status.HTTP_201_CREATED
)
async def create_webhook(
    payload: WebhookCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WebhookRead:
    if not (payload.url.startswith("http://") or payload.url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL musi być http(s)")
    hook = await svc.create_hook(
        db, current.id, payload.url, payload.secret, payload.events
    )
    return _to_read(hook)


@router.delete("/{hook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    hook_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    hook = await svc.get_hook(db, current.id, hook_id)
    if hook is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono webhooka")
    await svc.delete_hook(db, hook)


@router.post("/{hook_id}/test", response_model=WebhookTestResult)
async def test_webhook(
    hook_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WebhookTestResult:
    hook = await svc.get_hook(db, current.id, hook_id)
    if hook is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono webhooka")
    ok, detail = await svc.test_hook(db, hook)
    return WebhookTestResult(ok=ok, detail=detail)
