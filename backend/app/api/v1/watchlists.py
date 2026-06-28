from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.watchlists import (
    AddFromSearchRequest,
    CsvImportRequest,
    CsvImportResult,
    EntityBulkCreate,
    EntityBulkDelete,
    EntityCreate,
    EntityRead,
    EntityUpdate,
    ProspectSearchRequest,
    ProspectSearchResult,
    WatchlistCreate,
    WatchlistDetail,
    WatchlistRead,
    WatchlistUpdate,
)
from app.services import watchlists as svc

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


def _to_read(wl, total: int, comp: int, ppl: int) -> WatchlistRead:
    return WatchlistRead(
        id=wl.id,
        name=wl.name,
        description=wl.description,
        kind=wl.kind,
        source_url=wl.source_url,
        created_at=wl.created_at,
        updated_at=wl.updated_at,
        entities_count=total,
        companies_count=comp,
        people_count=ppl,
    )


async def _owned(db, current, wl_id):
    wl = await svc.get_watchlist(db, current.id, wl_id)
    if wl is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono listy")
    return wl


# ---------- Prospect search (must precede /{wl_id} routes) ----------


@router.get("/csv-template")
async def csv_template(
    kind: str = "company",
    current: User = Depends(get_current_user),
) -> Response:
    body = svc.csv_template("person" if kind == "person" else "company")
    fname = f"watchlist_{kind}_template.csv"
    return Response(
        content=body,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.post("/search", response_model=ProspectSearchResult)
async def search_prospects(
    payload: ProspectSearchRequest,
    current: User = Depends(get_current_user),
) -> ProspectSearchResult:
    provider, candidates = await svc.prospect_search(payload)
    return ProspectSearchResult(provider=provider, candidates=candidates)


# ---------- Watchlist CRUD ----------


@router.get("", response_model=list[WatchlistRead])
async def list_all(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WatchlistRead]:
    rows = await svc.list_watchlists(db, current.id)
    return [
        _to_read(
            r["wl"], r["entities_count"], r["companies_count"], r["people_count"]
        )
        for r in rows
    ]


@router.post("", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
async def create_one(
    payload: WatchlistCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistRead:
    wl = await svc.create_watchlist(db, current.id, payload)
    return _to_read(wl, 0, 0, 0)


@router.get("/{wl_id}", response_model=WatchlistDetail)
async def get_one(
    wl_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistDetail:
    wl = await _owned(db, current, wl_id)
    total, comp, ppl = await svc.counts_for(db, wl_id)
    ents = await svc.list_entities(db, wl_id)
    base = _to_read(wl, total, comp, ppl)
    return WatchlistDetail(
        **base.model_dump(),
        entities=[EntityRead.model_validate(e) for e in ents],
    )


@router.patch("/{wl_id}", response_model=WatchlistRead)
async def update_one(
    wl_id: int,
    payload: WatchlistUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchlistRead:
    wl = await _owned(db, current, wl_id)
    wl = await svc.update_watchlist(db, wl, payload)
    total, comp, ppl = await svc.counts_for(db, wl_id)
    return _to_read(wl, total, comp, ppl)


@router.delete("/{wl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    wl_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    wl = await _owned(db, current, wl_id)
    await svc.delete_watchlist(db, wl)


# ---------- Entities ----------


@router.get("/{wl_id}/entities", response_model=list[EntityRead])
async def list_entities(
    wl_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EntityRead]:
    await _owned(db, current, wl_id)
    ents = await svc.list_entities(db, wl_id)
    return [EntityRead.model_validate(e) for e in ents]


@router.post(
    "/{wl_id}/entities",
    response_model=list[EntityRead],
    status_code=status.HTTP_201_CREATED,
)
async def add_entities(
    wl_id: int,
    payload: EntityBulkCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EntityRead]:
    await _owned(db, current, wl_id)
    if not payload.entities:
        raise HTTPException(status_code=400, detail="Brak pozycji do dodania")
    objs = await svc.add_entities(db, wl_id, payload.entities)
    return [EntityRead.model_validate(o) for o in objs]


@router.patch("/{wl_id}/entities/{eid}", response_model=EntityRead)
async def update_entity(
    wl_id: int,
    eid: int,
    payload: EntityUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EntityRead:
    await _owned(db, current, wl_id)
    ent = await svc.get_entity(db, wl_id, eid)
    if ent is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono pozycji")
    ent = await svc.update_entity(db, ent, payload)
    return EntityRead.model_validate(ent)


@router.delete(
    "/{wl_id}/entities/{eid}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_entity(
    wl_id: int,
    eid: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _owned(db, current, wl_id)
    ent = await svc.get_entity(db, wl_id, eid)
    if ent is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono pozycji")
    await svc.delete_entity(db, ent)


@router.post("/{wl_id}/entities/bulk-delete", response_model=dict)
async def bulk_delete_entities(
    wl_id: int,
    payload: EntityBulkDelete,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _owned(db, current, wl_id)
    n = await svc.delete_entities(db, wl_id, payload.entity_ids)
    return {"deleted": n}


@router.post(
    "/{wl_id}/import-csv",
    response_model=CsvImportResult,
    status_code=status.HTTP_201_CREATED,
)
async def import_csv(
    wl_id: int,
    payload: CsvImportRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CsvImportResult:
    await _owned(db, current, wl_id)
    imported, skipped, errors = await svc.import_csv(db, wl_id, payload)
    return CsvImportResult(imported=imported, skipped=skipped, errors=errors)


@router.post(
    "/{wl_id}/add-from-search",
    response_model=list[EntityRead],
    status_code=status.HTTP_201_CREATED,
)
async def add_from_search(
    wl_id: int,
    payload: AddFromSearchRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EntityRead]:
    await _owned(db, current, wl_id)
    creates: list[EntityCreate] = [
        svc.candidate_to_create(c) for c in payload.candidates
    ]
    objs = await svc.add_entities(db, wl_id, creates)
    return [EntityRead.model_validate(o) for o in objs]
