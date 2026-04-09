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


async def import_csv(
    db: AsyncSession, list_id: int, csv_text: str
) -> CsvImportResult:
    """Import leads from CSV. Required column: `email`. Optional: first_name,
    last_name, company, title, linkedin_url, website, notes. Each row is
    committed individually so a single bad row doesn't roll back the batch."""
    reader = csv.DictReader(io.StringIO(csv_text))
    if reader.fieldnames is None or "email" not in reader.fieldnames:
        return CsvImportResult(
            imported=0,
            skipped=0,
            errors=["CSV missing required 'email' column"],
        )

    imported = 0
    skipped = 0
    errors: list[str] = []

    for row_num, row in enumerate(reader, start=2):
        email = (row.get("email") or "").strip()
        if not email:
            skipped += 1
            continue
        data = {
            k: (v.strip() if isinstance(v, str) and v.strip() else None)
            for k, v in row.items()
            if k in _VALID_CSV_FIELDS
        }
        data["email"] = email  # ensure email is set even if it had whitespace
        try:
            obj = Lead(list_id=list_id, **data)
            db.add(obj)
            await db.commit()
            imported += 1
        except Exception as e:
            await db.rollback()
            errors.append(f"row {row_num}: {e}")
            skipped += 1

    return CsvImportResult(imported=imported, skipped=skipped, errors=errors)
