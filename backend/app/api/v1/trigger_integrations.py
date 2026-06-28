from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services import trigger_integrations as svc

router = APIRouter(prefix="/trigger-integrations", tags=["trigger-integrations"])


class TriggerProviderStatus(BaseModel):
    key: str
    name: str
    description: str
    docs_url: str
    connect_kind: str
    key_hint: str
    connected: bool
    token_masked: str | None = None


class ConnectRequest(BaseModel):
    token: str = Field(min_length=1, max_length=1024)


@router.get("/providers", response_model=list[TriggerProviderStatus])
async def list_providers(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TriggerProviderStatus]:
    return [
        TriggerProviderStatus(**p) for p in await svc.list_status(db, current.id)
    ]


@router.post("/{provider}/connect", response_model=TriggerProviderStatus)
async def connect(
    provider: str,
    payload: ConnectRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TriggerProviderStatus:
    if not svc.is_provider(provider):
        raise HTTPException(status_code=404, detail="Nieznany dostawca")
    await svc.connect(db, current.id, provider, payload.token)
    status = await svc.list_status(db, current.id)
    return TriggerProviderStatus(
        **next(p for p in status if p["key"] == provider)
    )


@router.delete("/{provider}", status_code=204)
async def disconnect(
    provider: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not svc.is_provider(provider):
        raise HTTPException(status_code=404, detail="Nieznany dostawca")
    await svc.disconnect(db, current.id, provider)
