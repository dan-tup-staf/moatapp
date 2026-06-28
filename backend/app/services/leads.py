import csv
import io

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead
from app.models.lead_list import LeadList
from app.schemas.leads import (
    CsvImportResult,
    LeadCreate,
    LeadListCreate,
    LeadListUpdate,
    LeadUpdate,
)

# ---------- LeadList ----------


async def create_list(
    db: AsyncSession, user_id: int, payload: LeadListCreate
) -> LeadList:
    obj = LeadList(user_id=user_id, name=payload.name, description=payload.description)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def list_lists_with_counts(
    db: AsyncSession, user_id: int
) -> list[tuple[LeadList, int]]:
    """Returns (LeadList, leads_count) tuples for given user."""
    stmt = (
        select(LeadList, func.count(Lead.id))
        .outerjoin(Lead, Lead.list_id == LeadList.id)
        .where(LeadList.user_id == user_id)
        .group_by(LeadList.id)
        .order_by(LeadList.created_at.desc())
    )
    result = await db.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]


async def get_list(
    db: AsyncSession, user_id: int, list_id: int
) -> LeadList | None:
    stmt = select(LeadList).where(LeadList.id == list_id, LeadList.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def count_leads(db: AsyncSession, list_id: int) -> int:
    stmt = select(func.count(Lead.id)).where(Lead.list_id == list_id)
    result = await db.execute(stmt)
    return result.scalar_one()


async def update_list(
    db: AsyncSession, lead_list: LeadList, payload: LeadListUpdate
) -> LeadList:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(lead_list, k, v)
    await db.commit()
    await db.refresh(lead_list)
    return lead_list


async def delete_list(db: AsyncSession, lead_list: LeadList) -> None:
    await db.delete(lead_list)
    await db.commit()


# ---------- Lead ----------


async def create_lead(
    db: AsyncSession, list_id: int, payload: LeadCreate
) -> Lead:
    data = payload.model_dump()
    # Pydantic enum -> store the string value
    data["status"] = data["status"].value if hasattr(data["status"], "value") else data["status"]
    obj = Lead(list_id=list_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def list_leads_for_list(db: AsyncSession, list_id: int) -> list[Lead]:
    stmt = (
        select(Lead).where(Lead.list_id == list_id).order_by(Lead.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_lead(
    db: AsyncSession, list_id: int, lead_id: int
) -> Lead | None:
    stmt = select(Lead).where(Lead.id == lead_id, Lead.list_id == list_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_lead(db: AsyncSession, lead: Lead, payload: LeadUpdate) -> Lead:
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and hasattr(data["status"], "value"):
        data["status"] = data["status"].value
    for k, v in data.items():
        setattr(lead, k, v)
    await db.commit()
    await db.refresh(lead)
    return lead


async def delete_lead(db: AsyncSession, lead: Lead) -> None:
    await db.delete(lead)
    await db.commit()


# ---------- CSV import ----------

_VALID_CSV_FIELDS = {
    "email",
    "first_name",
    "last_name",
    "company",
    "title",
    "linkedin_url",
    "website",
    "notes",
}

# Map common export-header names (Apollo, Lusha, Prospeo, Sales Navigator,
# Polish exports) to our canonical lead fields. Headers are lowercased and
# stripped of surrounding whitespace before lookup.
_CSV_HEADER_ALIASES = {
    # email
    "email": "email",
    "email address": "email",
    "e-mail": "email",
    "e-mail address": "email",
    "work email": "email",
    "work e-mail": "email",
    "primary email": "email",
    "business email": "email",
    "mail": "email",
    # first name
    "first_name": "first_name",
    "first name": "first_name",
    "firstname": "first_name",
    "imię": "first_name",
    "imie": "first_name",
    # last name
    "last_name": "last_name",
    "last name": "last_name",
    "lastname": "last_name",
    "surname": "last_name",
    "nazwisko": "last_name",
    # company
    "company": "company",
    "company name": "company",
    "company name for emails": "company",
    "organization": "company",
    "organization name": "company",
    "account name": "company",
    "employer": "company",
    "firma": "company",
    "nazwa firmy": "company",
    # title
    "title": "title",
    "job title": "title",
    "position": "title",
    "headline": "title",
    "stanowisko": "title",
    # linkedin
    "linkedin_url": "linkedin_url",
    "linkedin": "linkedin_url",
    "linkedin url": "linkedin_url",
    "person linkedin url": "linkedin_url",
    "linkedin profile": "linkedin_url",
    "profil linkedin": "linkedin_url",
    # website / domain
    "website": "website",
    "company website": "website",
    "www": "website",
    "domain": "website",
    "company domain": "website",
    "strona": "website",
    # notes
    "notes": "notes",
    "note": "notes",
    "uwagi": "notes",
}


def _normalize_header(h: str | None) -> str | None:
    if not h:
        return None
    key = h.strip().lstrip("﻿").strip().lower()
    if key in _CSV_HEADER_ALIASES:
        return _CSV_HEADER_ALIASES[key]
    # Already-canonical headers pass through.
    return key if key in _VALID_CSV_FIELDS else None


async def import_csv(
    db: AsyncSession, list_id: int, csv_text: str
) -> CsvImportResult:
    """Import leads from CSV. Required column: `email` (also accepts common
    export header names like 'Email', 'Email Address', 'Work Email'). Optional:
    first_name, last_name, company, title, linkedin_url, website, notes.

    Tolerant: strips a UTF-8 BOM, auto-detects comma vs semicolon delimiter, and
    maps Apollo / Lusha / Prospeo / Sales Navigator / Polish header names. Rows
    are inserted in one batch (fast); if the batch hits a bad row it falls back
    to per-row commits so one bad row doesn't drop the rest."""
    text = (csv_text or "").lstrip("﻿")
    if not text.strip():
        return CsvImportResult(imported=0, skipped=0, errors=["Pusty plik CSV"])

    # Detect delimiter from the header line (Polish Excel often uses ';').
    first_line = text.splitlines()[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = [r for r in reader if any((c or "").strip() for c in r)]
    if not rows:
        return CsvImportResult(imported=0, skipped=0, errors=["Brak danych w CSV"])

    cols = [_normalize_header(h) for h in rows[0]]
    if "email" not in cols:
        return CsvImportResult(
            imported=0,
            skipped=0,
            errors=[
                "CSV nie ma kolumny e-mail. Akceptowane nagłówki to m.in. "
                "email, Email, Email Address, Work Email."
            ],
        )

    email_idx = cols.index("email")
    pending: list[Lead] = []
    skipped = 0
    errors: list[str] = []

    for row_num, row in enumerate(rows[1:], start=2):
        email = (row[email_idx].strip() if email_idx < len(row) else "")
        if not email:
            skipped += 1
            continue
        data: dict[str, str] = {}
        for idx, val in enumerate(row):
            field = cols[idx] if idx < len(cols) else None
            if field and field in _VALID_CSV_FIELDS and field != "email":
                v = (val or "").strip()
                if v:
                    data[field] = v
        data["email"] = email
        pending.append(Lead(list_id=list_id, **data))

    if not pending:
        return CsvImportResult(imported=0, skipped=skipped, errors=errors)

    # Fast path: insert all at once.
    db.add_all(pending)
    try:
        await db.commit()
        return CsvImportResult(
            imported=len(pending), skipped=skipped, errors=errors
        )
    except Exception:
        await db.rollback()

    # Fallback: per-row so one bad/duplicate row doesn't kill the batch.
    imported = 0
    for i, lead in enumerate(pending, start=2):
        obj = Lead(list_id=list_id, email=lead.email)
        for f in _VALID_CSV_FIELDS:
            if f != "email":
                setattr(obj, f, getattr(lead, f, None))
        db.add(obj)
        try:
            await db.commit()
            imported += 1
        except Exception as e:  # noqa: BLE001
            await db.rollback()
            errors.append(f"wiersz {i}: {type(e).__name__}")
            skipped += 1
    return CsvImportResult(imported=imported, skipped=skipped, errors=errors)
