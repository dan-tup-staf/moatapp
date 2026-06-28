from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services import crm_integrations as svc

router = APIRouter(prefix="/crm-integrations", tags=["crm-integrations"])


class CrmProviderStatus(BaseModel):
    key: str
    name: str
    description: str
    docs_url: str
    key_hint: str
    needs_domain: bool
    actions: list[str]
    connected: bool
    enabled: bool
    key_masked: str | None = None
    domain: str | None = None


class ConnectRequest(BaseModel):
    api_key: str = Field(min_length=1, max_length=1024)
    domain: str | None = Field(default=None, max_length=255)


@router.get("/providers", response_model=list[CrmProviderStatus])
async def list_providers(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CrmProviderStatus]:
    return [CrmProviderStatus(**p) for p in await svc.list_status(db, current.id)]


def _check(provider: str) -> None:
    if not svc.is_provider(provider):
        raise HTTPException(status_code=404, detail="Nieznany CRM")


@router.post("/{provider}/connect", response_model=CrmProviderStatus)
async def connect(
    provider: str,
    payload: ConnectRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CrmProviderStatus:
    _check(provider)
    await svc.connect(db, current.id, provider, payload.api_key, payload.domain)
    status = await svc.list_status(db, current.id)
    return CrmProviderStatus(**next(p for p in status if p["key"] == provider))


@router.delete("/{provider}", status_code=204)
async def disconnect(
    provider: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    _check(provider)
    await svc.disconnect(db, current.id, provider)
