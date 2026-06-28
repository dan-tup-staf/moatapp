"""Plan definitions — single source of truth for tiers, prices and limits.

Limits are enforced server-side where it matters (leads, daily sends). `None`
means unlimited. Stripe price ids are read from env so the same code works in
test/live without editing the table.
"""

from app.config import settings

PLANS: dict[str, dict] = {
    "free": {
        "key": "free",
        "name": "Free",
        "price_pln": 0,
        "period": "na zawsze",
        "limits": {
            "mailboxes": 1,
            "leads": 250,
            "daily_sends": 50,
            "signal_sources": 3,
            "enrichment_credits": 0,
            "seats": 1,
        },
        "features": [
            "1 skrzynka mailowa",
            "Do 250 leadów",
            "50 wysyłek / dzień",
            "Profil klienta (ICP) + AI",
            "Sygnały z darmowych źródeł",
        ],
        "stripe_price_id": None,
    },
    "pro": {
        "key": "pro",
        "name": "Pro",
        "price_pln": 149,
        "period": "/ mies.",
        "limits": {
            "mailboxes": 5,
            "leads": 10000,
            "daily_sends": 500,
            "signal_sources": 50,
            "enrichment_credits": 1000,
            "seats": 3,
        },
        "features": [
            "5 skrzynek + rotacja",
            "Do 10 000 leadów",
            "500 wysyłek / dzień",
            "Sekwencje A/B + warunkowe",
            "Wzbogacanie danych (Apollo/Lusha/Prospeo)",
            "Wszystkie źródła sygnałów",
        ],
        "stripe_price_id": settings.stripe_price_pro or None,
    },
    "scale": {
        "key": "scale",
        "name": "Scale",
        "price_pln": None,  # contact sales
        "period": "",
        "limits": {
            "mailboxes": None,
            "leads": None,
            "daily_sends": None,
            "signal_sources": None,
            "enrichment_credits": 10000,
            "seats": None,
        },
        "features": [
            "Nielimitowane skrzynki",
            "Nielimitowane leady",
            "Zespół i role",
            "Webhooki / CRM",
            "Priorytetowe wsparcie",
        ],
        "stripe_price_id": settings.stripe_price_scale or None,
    },
}

ORDER = ["free", "pro", "scale"]


def get_plan(key: str | None) -> dict:
    return PLANS.get(key or "free", PLANS["free"])


def plan_limit(key: str | None, limit_name: str):
    """Return the numeric limit (or None for unlimited) for a plan."""
    return get_plan(key)["limits"].get(limit_name)
