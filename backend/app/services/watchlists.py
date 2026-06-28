"""Watchlists — named lists of companies / people to track with signal sources.

Populate a watchlist by CSV upload, manual entry, a LinkedIn search link, or the
built-in prospect search (Lusha / Prospeo-style, backed by the active web-search
provider). Attach a watchlist to a signal source (config.watchlist_id) and the
source scrapes per-entity instead of one global query.
"""

import csv
import io
import logging
import re
from urllib.parse import urlparse

from sqlalchemy import Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.watchlist import Watchlist, WatchlistEntity
from app.schemas.watchlists import (
    CsvImportRequest,
    EntityCreate,
    ProspectCandidate,
    ProspectSearchRequest,
    WatchlistCreate,
    WatchlistUpdate,
)

logger = logging.getLogger(__name__)


# ---------- Watchlist CRUD ----------


async def create_watchlist(
    db: AsyncSession, user_id: int, payload: WatchlistCreate
) -> Watchlist:
    obj = Watchlist(
        user_id=user_id,
        name=payload.name,
        description=payload.description,
        kind=payload.kind,
        source_url=payload.source_url,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def list_watchlists(db: AsyncSession, user_id: int) -> list[dict]:
    """Watchlists + counts (total / companies / people) in one query."""
    company_case = func.sum(
        func.cast(WatchlistEntity.kind == "company", type_=Integer)
    )
    person_case = func.sum(
        func.cast(WatchlistEntity.kind == "person", type_=Integer)
    )
    stmt = (
        select(
            Watchlist,
            func.count(WatchlistEntity.id),
            func.coalesce(company_case, 0),
            func.coalesce(person_case, 0),
        )
        .outerjoin(WatchlistEntity, WatchlistEntity.watchlist_id == Watchlist.id)
        .where(Watchlist.user_id == user_id)
        .group_by(Watchlist.id)
        .order_by(Watchlist.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    out: list[dict] = []
    for wl, total, comp, ppl in rows:
        out.append(
            {
                "wl": wl,
                "entities_count": int(total or 0),
                "companies_count": int(comp or 0),
                "people_count": int(ppl or 0),
            }
        )
    return out


async def get_watchlist(
    db: AsyncSession, user_id: int, wl_id: int
) -> Watchlist | None:
    stmt = select(Watchlist).where(
        Watchlist.id == wl_id, Watchlist.user_id == user_id
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def update_watchlist(
    db: AsyncSession, wl: Watchlist, payload: WatchlistUpdate
) -> Watchlist:
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(wl, k, v)
    await db.commit()
    await db.refresh(wl)
    return wl


async def delete_watchlist(db: AsyncSession, wl: Watchlist) -> None:
    await db.delete(wl)
    await db.commit()


async def counts_for(db: AsyncSession, wl_id: int) -> tuple[int, int, int]:
    rows = (
        await db.execute(
            select(WatchlistEntity.kind, func.count(WatchlistEntity.id))
            .where(WatchlistEntity.watchlist_id == wl_id)
            .group_by(WatchlistEntity.kind)
        )
    ).all()
    by_kind = {k: int(c) for k, c in rows}
    comp = by_kind.get("company", 0)
    ppl = by_kind.get("person", 0)
    return comp + ppl, comp, ppl


# ---------- Entities ----------


async def list_entities(
    db: AsyncSession, wl_id: int
) -> list[WatchlistEntity]:
    rows = (
        await db.execute(
            select(WatchlistEntity)
            .where(WatchlistEntity.watchlist_id == wl_id)
            .order_by(WatchlistEntity.created_at.desc(), WatchlistEntity.id.desc())
        )
    ).scalars().all()
    return list(rows)


def _entity_from_create(wl_id: int, e: EntityCreate) -> WatchlistEntity:
    return WatchlistEntity(
        watchlist_id=wl_id,
        kind=e.kind.value if hasattr(e.kind, "value") else e.kind,
        name=e.name.strip(),
        company=(e.company or None),
        domain=_clean_domain(e.domain),
        linkedin_url=(e.linkedin_url or None),
        title=(e.title or None),
        location=(e.location or None),
        industry=(e.industry or None),
        extra=e.extra or {},
    )


async def add_entities(
    db: AsyncSession, wl_id: int, entities: list[EntityCreate]
) -> list[WatchlistEntity]:
    objs = [_entity_from_create(wl_id, e) for e in entities if e.name.strip()]
    if not objs:
        return []
    db.add_all(objs)
    await db.commit()
    for o in objs:
        await db.refresh(o)
    await _touch(db, wl_id)
    return objs


async def get_entity(
    db: AsyncSession, wl_id: int, eid: int
) -> WatchlistEntity | None:
    stmt = select(WatchlistEntity).where(
        WatchlistEntity.id == eid, WatchlistEntity.watchlist_id == wl_id
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def update_entity(db: AsyncSession, ent: WatchlistEntity, payload) -> WatchlistEntity:
    data = payload.model_dump(exclude_unset=True)
    if "domain" in data:
        data["domain"] = _clean_domain(data["domain"])
    if "kind" in data and hasattr(data["kind"], "value"):
        data["kind"] = data["kind"].value
    for k, v in data.items():
        setattr(ent, k, v)
    await db.commit()
    await db.refresh(ent)
    return ent


async def delete_entity(db: AsyncSession, ent: WatchlistEntity) -> None:
    wl_id = ent.watchlist_id
    await db.delete(ent)
    await db.commit()
    await _touch(db, wl_id)


async def delete_entities(db: AsyncSession, wl_id: int, ids: list[int]) -> int:
    rows = (
        await db.execute(
            select(WatchlistEntity).where(
                WatchlistEntity.watchlist_id == wl_id,
                WatchlistEntity.id.in_(ids),
            )
        )
    ).scalars().all()
    n = 0
    for r in rows:
        await db.delete(r)
        n += 1
    await db.commit()
    if n:
        await _touch(db, wl_id)
    return n


async def _touch(db: AsyncSession, wl_id: int) -> None:
    wl = await db.get(Watchlist, wl_id)
    if wl is not None:
        from datetime import datetime, timezone

        wl.updated_at = datetime.now(timezone.utc)
        await db.commit()


# ---------- CSV import ----------

CSV_TEMPLATE_COMPANY = (
    "name,domain,industry,location,linkedin_url\n"
    "Acme Sp. z o.o.,acme.pl,SaaS,Warszawa,https://www.linkedin.com/company/acme\n"
    "Przykład S.A.,przyklad.pl,Fintech,Kraków,\n"
)

CSV_TEMPLATE_PERSON = (
    "name,company,title,domain,location,linkedin_url\n"
    "Jan Kowalski,Acme Sp. z o.o.,Head of Sales,acme.pl,Warszawa,"
    "https://www.linkedin.com/in/jankowalski\n"
    "Anna Nowak,Przykład S.A.,CMO,przyklad.pl,Kraków,\n"
)


def csv_template(kind: str) -> str:
    return CSV_TEMPLATE_PERSON if kind == "person" else CSV_TEMPLATE_COMPANY


# Accept a few header aliases so messy exports still import.
_HEADER_ALIASES = {
    "name": "name",
    "nazwa": "name",
    "firma": "name",
    "company name": "name",
    "company": "company",
    "domain": "domain",
    "domena": "domain",
    "website": "domain",
    "strona": "domain",
    "www": "domain",
    "industry": "industry",
    "branża": "industry",
    "branza": "industry",
    "location": "location",
    "lokalizacja": "location",
    "miasto": "location",
    "city": "location",
    "title": "title",
    "stanowisko": "title",
    "position": "title",
    "role": "title",
    "linkedin_url": "linkedin_url",
    "linkedin": "linkedin_url",
    "li_url": "linkedin_url",
    "profil": "linkedin_url",
}


def parse_csv(csv_text: str, kind: str) -> tuple[list[EntityCreate], int, list[str]]:
    """Parse pasted/uploaded CSV into EntityCreate rows. Returns
    (entities, skipped, errors). Tolerant: maps header aliases, skips blanks."""
    errors: list[str] = []
    text = csv_text.strip()
    if not text:
        return [], 0, ["Pusty plik CSV."]

    # Detect delimiter (comma vs semicolon — Polish Excel loves semicolons).
    sample = text.splitlines()[0]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return [], 0, ["Brak danych w CSV."]

    header_raw = [c.strip().lower() for c in rows[0]]
    has_header = any(h in _HEADER_ALIASES for h in header_raw)
    if has_header:
        cols = [_HEADER_ALIASES.get(h) for h in header_raw]
        data_rows = rows[1:]
    else:
        # No recognizable header → assume first column is the name.
        cols = ["name"] + [None] * (len(rows[0]) - 1)
        data_rows = rows

    entities: list[EntityCreate] = []
    skipped = 0
    for i, row in enumerate(data_rows, start=1):
        rec: dict[str, str] = {}
        for idx, val in enumerate(row):
            if idx < len(cols) and cols[idx]:
                v = val.strip()
                if v:
                    rec[cols[idx]] = v
        name = rec.get("name", "").strip()
        if not name:
            skipped += 1
            continue
        try:
            entities.append(
                EntityCreate(
                    kind=kind,  # type: ignore[arg-type]
                    name=name,
                    company=rec.get("company"),
                    domain=rec.get("domain"),
                    title=rec.get("title"),
                    location=rec.get("location"),
                    industry=rec.get("industry"),
                    linkedin_url=rec.get("linkedin_url"),
                )
            )
        except Exception as e:  # noqa: BLE001
            errors.append(f"Wiersz {i}: {e}")
            skipped += 1
    return entities, skipped, errors


async def import_csv(
    db: AsyncSession, wl_id: int, payload: CsvImportRequest
) -> tuple[int, int, list[str]]:
    kind = payload.kind.value if hasattr(payload.kind, "value") else payload.kind
    entities, skipped, errors = parse_csv(payload.csv_text, kind)
    created = await add_entities(db, wl_id, entities)
    return len(created), skipped, errors


# ---------- Prospect search (Lusha / Prospeo-style) ----------


def _clean_domain(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    if not v:
        return None
    if "://" in v or v.startswith("www.") or "/" in v:
        try:
            parsed = urlparse(v if "://" in v else f"http://{v}")
            v = parsed.netloc or parsed.path
        except Exception:  # noqa: BLE001
            pass
    v = v.split("/")[0]
    if v.startswith("www."):
        v = v[4:]
    return v or None


_LI_COMPANY = re.compile(r"linkedin\.com/company/([^/?#]+)", re.I)
_LI_PERSON = re.compile(r"linkedin\.com/in/([^/?#]+)", re.I)


def _build_query(req: ProspectSearchRequest) -> str:
    parts: list[str] = []
    is_person = (req.kind.value if hasattr(req.kind, "value") else req.kind) == "person"
    if is_person:
        if req.title:
            parts.append(f'"{req.title}"')
        if req.seniority:
            parts.append(req.seniority)
        if req.department:
            parts.append(req.department)
        if req.company:
            parts.append(req.company)
        if req.keywords:
            parts.append(req.keywords)
        if req.industry:
            parts.append(req.industry)
        if req.location:
            parts.append(req.location)
        if req.technology:
            parts.append(req.technology)
        parts.append("site:linkedin.com/in")
    else:
        if req.keywords:
            parts.append(req.keywords)
        if req.industry:
            parts.append(req.industry)
        if req.location:
            parts.append(req.location)
        if req.technology:
            parts.append(req.technology)
        if req.funding:
            parts.append(req.funding)
        if req.intent:
            parts.append(req.intent)
        if req.year_founded:
            parts.append(f"founded {req.year_founded}")
        # Headcount/revenue/size are soft hints appended as plain terms.
        for hint in (req.size, req.headcount, req.revenue):
            if hint:
                parts.append(hint)
        parts.append("firma OR company")
    return " ".join(p for p in parts if p).strip()


def _parse_company_candidate(r: dict) -> ProspectCandidate:
    title = (r.get("title") or "").strip()
    url = r.get("url") or ""
    domain = _clean_domain(url)
    li = None
    m = _LI_COMPANY.search(url)
    if m:
        li = url
        domain = None  # the result IS a linkedin page, not a company site
    # Strip trailing " - LinkedIn" / " | site" noise from the title for a name.
    name = re.split(r"\s[-|–]\s", title)[0].strip() or title
    return ProspectCandidate(
        kind="company",  # type: ignore[arg-type]
        name=name[:255] or (domain or "Firma"),
        domain=domain,
        linkedin_url=li,
        summary=(r.get("summary") or "")[:500],
        source_url=url or None,
    )


def _parse_person_candidate(r: dict) -> ProspectCandidate:
    title = (r.get("title") or "").strip()
    url = r.get("url") or ""
    li = url if _LI_PERSON.search(url) else None
    # LinkedIn result titles look like: "Jan Kowalski - Head of Sales - Acme | LinkedIn"
    segs = [s.strip() for s in re.split(r"\s[-|–]\s", title) if s.strip()]
    name = segs[0] if segs else title
    role = segs[1] if len(segs) > 1 else None
    company = None
    for s in segs[2:]:
        if s.lower() not in ("linkedin", "li"):
            company = s
            break
    return ProspectCandidate(
        kind="person",  # type: ignore[arg-type]
        name=name[:255] or "Osoba",
        title=role,
        company=company,
        linkedin_url=li,
        summary=(r.get("summary") or "")[:500],
        source_url=url or None,
    )


async def prospect_search(req: ProspectSearchRequest) -> tuple[str, list[ProspectCandidate]]:
    """Discover candidate companies/people from filters via the active web
    search provider. Returns (provider, candidates)."""
    from app.scrapers.search import active_provider, web_search

    query = _build_query(req)
    if not query:
        return active_provider(), []
    results = await web_search(query, req.max_results)
    is_person = (req.kind.value if hasattr(req.kind, "value") else req.kind) == "person"
    parser = _parse_person_candidate if is_person else _parse_company_candidate

    seen: set[str] = set()
    out: list[ProspectCandidate] = []
    for r in results:
        if not r.get("url"):
            continue
        cand = parser(r)
        key = (cand.linkedin_url or cand.domain or cand.source_url or cand.name).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cand)
    return active_provider(), out


def candidate_to_create(c: ProspectCandidate) -> EntityCreate:
    return EntityCreate(
        kind=c.kind,
        name=c.name,
        company=c.company,
        domain=c.domain,
        linkedin_url=c.linkedin_url,
        title=c.title,
        location=c.location,
        industry=c.industry,
        extra={"summary": c.summary} if c.summary else {},
    )


# ---------- Scraper integration helpers ----------


async def entity_search_terms(
    db: AsyncSession, wl_id: int
) -> list[tuple[str, str | None]]:
    """For a watchlist, return [(search_term, company_domain), ...] — one per
    entity. The signal source runner expands its base query over these so each
    company/person is tracked individually."""
    ents = await list_entities(db, wl_id)
    out: list[tuple[str, str | None]] = []
    for e in ents:
        if e.kind == "person":
            term = e.name
            if e.company:
                term = f"{e.name} {e.company}"
            out.append((term, e.domain))
        else:
            out.append((e.name, e.domain))
    return out
