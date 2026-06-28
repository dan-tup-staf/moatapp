from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services import enrichment as svc

router = APIRouter(prefix="/enrichment", tags=["enrichment"])


class ProviderStatus(BaseModel):
    key: str
    name: str
    description: str
    docs_url: str
    key_hint: str
    capabilities: list[str]
    connected: bool
    enabled: bool
    key_masked: str | None = None


class ConnectRequest(BaseModel):
    api_key: str = Field(min_length=1, max_length=512)


class EnabledRequest(BaseModel):
    enabled: bool


@router.get("/providers", response_model=list[ProviderStatus])
async def list_providers(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProviderStatus]:
    return [ProviderStatus(**p) for p in await svc.list_status(db, current.id)]


def _check(provider: str) -> None:
    if not svc.is_provider(provider):
        raise HTTPException(status_code=404, detail="Nieznany dostawca")


@router.post("/{provider}/connect", response_model=ProviderStatus)
async def connect(
    provider: str,
    payload: ConnectRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProviderStatus:
    _check(provider)
    await svc.connect(db, current.id, provider, payload.api_key)
    status = await svc.list_status(db, current.id)
    return ProviderStatus(**next(p for p in status if p["key"] == provider))


@router.patch("/{provider}", response_model=ProviderStatus)
async def set_enabled(
    provider: str,
    payload: EnabledRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProviderStatus:
    _check(provider)
    row = await svc.set_enabled(db, current.id, provider, payload.enabled)
    if row is None:
        raise HTTPException(status_code=404, detail="Najpierw podłącz dostawcę")
    status = await svc.list_status(db, current.id)
    return ProviderStatus(**next(p for p in status if p["key"] == provider))


@router.delete("/{provider}", status_code=204)
async def disconnect(
    provider: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    _check(provider)
    await svc.disconnect(db, current.id, provider)


@router.post("/{provider}/test")
async def test(
    provider: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Confirms the connection. Enrichment itself is not live yet — returns an
    honest 'mechanism pending' message so the UI can show real status."""
    _check(provider)
    try:
        await svc.enrich_contact(db, current.id, provider, {})
    except svc.EnrichmentNotReady as e:
        return {"ready": False, "message": str(e)}
    return {"ready": True, "message": "OK"}
