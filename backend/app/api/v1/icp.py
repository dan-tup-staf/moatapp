from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.icp import (
    AnalyzeUrlRequest,
    AnalyzeUrlResponse,
    IcpFields,
    IcpFieldsUpdate,
    IcpProfileRead,
    SynthesizeRequest,
)
from app.services import icp as svc
from app.services.icp import AnthropicNotConfigured

router = APIRouter(prefix="/icp", tags=["icp"])


def _to_read(obj) -> IcpProfileRead:
    return IcpProfileRead(
        id=obj.id,
        source_url=obj.source_url,
        scraped_summary=obj.scraped_summary,
        qa_history=obj.qa_history or [],
        icp_fields=IcpFields(**(obj.icp_fields or {})),
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


@router.get("", response_model=IcpProfileRead | None)
async def get_mine(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IcpProfileRead | None:
    obj = await svc.get_or_none(db, current.id)
    return _to_read(obj) if obj else None


@router.post("/analyze-url", response_model=AnalyzeUrlResponse)
async def analyze_url(
    payload: AnalyzeUrlRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalyzeUrlResponse:
    manual = (payload.manual_description or "").strip()
    url_str = str(payload.url) if payload.url else None

    if not url_str and not manual:
        raise HTTPException(
            status_code=400,
            detail="Podaj URL strony firmy lub ręczny opis firmy",
        )

    if manual:
        # Użyj opisu ręcznego jako źródła prawdy (pomijamy scraping)
        scraped = f"MANUAL DESCRIPTION:\n{manual}"
    else:
        try:
            scraped = await svc.scrape_company_site(url_str)
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        questions = await svc.generate_questions(scraped)
    except AnthropicNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    await svc.upsert_after_analysis(
        db, current.id, url_str or "(manual)", scraped, questions
    )
    return AnalyzeUrlResponse(
        scraped_summary=scraped, suggested_questions=questions
    )


@router.post("/synthesize", response_model=IcpProfileRead)
async def synthesize(
    payload: SynthesizeRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IcpProfileRead:
    existing = await svc.get_or_none(db, current.id)
    if existing is None or not existing.scraped_summary:
        raise HTTPException(
            status_code=400,
            detail="Najpierw wywołaj /icp/analyze-url aby przeanalizować stronę firmy",
        )
    try:
        fields = await svc.synthesize_icp(existing.scraped_summary, payload.qa)
    except AnthropicNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    obj = await svc.upsert_after_synthesis(db, current.id, payload.qa, fields)
    return _to_read(obj)


@router.patch("", response_model=IcpProfileRead)
async def update_fields(
    payload: IcpFieldsUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IcpProfileRead:
    obj = await svc.update_fields(db, current.id, payload)
    if obj is None:
        raise HTTPException(status_code=404, detail="ICP not found")
    return _to_read(obj)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await svc.delete_for_user(db, current.id)
