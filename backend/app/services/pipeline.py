"""Pipeline view — companies bucketed into 4 buying-journey stages.

Stage is derived from the highest `Lead.status` among each company's leads:
    new       → awareness
    contacted → education
    replied   → requirements
    vendor_selection stage stays empty for now; future work will fill it
    based on manual overrides or high-intent website activity (e.g. visits
    to /pricing). bounced/unsubscribed leads are excluded.

Tier is derived from `sum(lead.score)` per company:
    > 100 → T1
    > 20  → T2
    else  → T3
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.crm import list_companies_for_user

# Mapping from highest-status to pipeline stage. Leads whose status doesn't
# appear here (bounced, unsubscribed) are filtered out of the pipeline view.
_STATUS_TO_STAGE: dict[str, str] = {
    "new": "awareness",
    "contacted": "education",
    "replied": "requirements",
}

_STAGE_LABELS: dict[str, str] = {
    "awareness": "Świadomość",
    "education": "Edukacja o rozwiązaniach",
    "requirements": "Budowanie wymagań",
    "vendor_selection": "Wybór dostawcy",
}

_STAGE_ORDER: list[str] = [
    "awareness",
    "education",
    "requirements",
    "vendor_selection",
]


def _tier_for_score(score: int) -> int:
    if score > 100:
        return 1
    if score > 20:
        return 2
    return 3


async def build_pipeline(db: AsyncSession, user_id: int) -> dict:
    """Reuses the CRM company aggregates and buckets them into stages."""
    companies = await list_companies_for_user(db, user_id)

    buckets: dict[str, list[dict]] = {s: [] for s in _STAGE_ORDER}

    for row in companies:
        stage = _STATUS_TO_STAGE.get(row["highest_status"])
        if stage is None:
            continue  # bounced / unsubscribed — skip pipeline

        buckets[stage].append(
            {
                "company": row["company"],
                "leads_count": row["leads_count"],
                "total_score": int(row["total_score"]),
                "tier": _tier_for_score(int(row["total_score"])),
                "signals_count": row["signals_count"],
                "last_activity_at": row["last_message_sent_at"],
            }
        )

    # Sort each bucket: tier asc (T1 first), then score desc
    for arr in buckets.values():
        arr.sort(key=lambda c: (c["tier"], -c["total_score"]))

    stages = []
    for stage_key in _STAGE_ORDER:
        arr = buckets[stage_key]
        stages.append(
            {
                "stage": stage_key,
                "name": _STAGE_LABELS[stage_key],
                "companies": arr,
                "companies_count": len(arr),
                "total_score": sum(c["total_score"] for c in arr),
            }
        )

    return {"stages": stages}
