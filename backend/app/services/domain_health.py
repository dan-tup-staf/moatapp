"""Domain health checks via DNS-over-HTTPS (Google DoH JSON API).

Checks the records that matter for cold-email deliverability:
  - SPF   (TXT  @ domain          starting with v=spf1)
  - DKIM  (TXT  @ <selector>._domainkey.domain — common selectors probed)
  - DMARC (TXT  @ _dmarc.domain   containing v=DMARC1)
  - MX    (MX   @ domain          at least one record)

No system resolver / extra dependency: we call the DoH JSON endpoint over
httpx (already a dependency). Runs on the API host's outbound network.
"""

import logging
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Popular DKIM selectors to probe (we can't enumerate DNS, so we guess the
# common ones used by Google Workspace, Microsoft, Mailgun, SendGrid, etc.).
DKIM_SELECTORS = [
    "google",
    "default",
    "selector1",
    "selector2",
    "k1",
    "k2",
    "mail",
    "dkim",
    "s1",
    "s2",
    "smtp",
    "mandrill",
    "mxvault",
]


def normalize_domain(raw: str) -> str:
    """Accept a pasted URL or email-ish string and return the bare host."""
    s = (raw or "").strip().lower()
    if not s:
        return ""
    if "@" in s:
        s = s.split("@", 1)[1]
    if "://" in s:
        s = urlparse(s).netloc or s
    s = s.split("/", 1)[0]
    return s.strip().strip(".")


async def _answers(client: httpx.AsyncClient, name: str, rtype: str) -> list[dict]:
    try:
        r = await client.get(
            settings.doh_url,
            params={"name": name, "type": rtype},
            headers={"accept": "application/dns-json"},
        )
    except Exception:
        logger.warning("DoH query failed for %s %s", rtype, name)
        return []
    if r.status_code != 200:
        return []
    try:
        return r.json().get("Answer") or []
    except Exception:
        return []


def _txt_values(answers: list[dict]) -> list[str]:
    out = []
    for a in answers:
        if a.get("type") == 16:  # TXT
            d = (a.get("data") or "").strip()
            # DoH returns TXT possibly quoted and split into "chunk" "chunk".
            d = d.replace('" "', "").strip('"')
            if d:
                out.append(d)
    return out


# Recipient ESP classification (for ESP matching) — cached per process.
_ESP_CACHE: dict[str, str] = {}


async def detect_esp(domain_or_email: str) -> str:
    """Classify a recipient's mail provider from MX records:
    'google' | 'microsoft' | 'other'. Cached per domain for the process."""
    domain = normalize_domain(domain_or_email)
    if not domain:
        return "other"
    if domain in _ESP_CACHE:
        return _ESP_CACHE[domain]
    async with httpx.AsyncClient(timeout=10) as client:
        mx_ans = await _answers(client, domain, "MX")
    hosts = " ".join(
        (a.get("data") or "").lower() for a in mx_ans if a.get("type") == 15
    )
    if any(k in hosts for k in ("google", "googlemail", "aspmx")):
        esp = "google"
    elif any(
        k in hosts for k in ("outlook", "protection.outlook", "microsoft")
    ):
        esp = "microsoft"
    else:
        esp = "other"
    _ESP_CACHE[domain] = esp
    return esp


async def check_domain(domain: str) -> dict[str, Any]:
    domain = normalize_domain(domain)
    if not domain:
        return {
            "domain": "",
            "checks": {},
            "score": 0,
            "max_score": 4,
            "healthy": False,
        }

    async with httpx.AsyncClient(timeout=15) as client:
        spf_txt = _txt_values(await _answers(client, domain, "TXT"))
        spf = next((t for t in spf_txt if t.lower().startswith("v=spf1")), None)

        dmarc_txt = _txt_values(await _answers(client, f"_dmarc.{domain}", "TXT"))
        dmarc = next((t for t in dmarc_txt if "v=dmarc1" in t.lower()), None)

        mx_ans = await _answers(client, domain, "MX")
        mx = [a.get("data", "").strip() for a in mx_ans if a.get("type") == 15]

        dkim_sel = None
        for sel in DKIM_SELECTORS:
            recs = _txt_values(
                await _answers(client, f"{sel}._domainkey.{domain}", "TXT")
            )
            if any("v=dkim1" in t.lower() or "p=" in t.lower() for t in recs):
                dkim_sel = sel
                break

    checks = {
        "spf": {
            "ok": bool(spf),
            "detail": spf or "Brak rekordu SPF (TXT zaczynający się od v=spf1)",
        },
        "dkim": {
            "ok": bool(dkim_sel),
            "detail": (
                f"Znaleziono klucz DKIM (selektor: {dkim_sel})"
                if dkim_sel
                else "Nie znaleziono klucza DKIM w popularnych selektorach"
            ),
        },
        "dmarc": {
            "ok": bool(dmarc),
            "detail": dmarc or "Brak rekordu DMARC (_dmarc.<domena>)",
        },
        "mx": {
            "ok": bool(mx),
            "detail": ", ".join(mx[:3]) if mx else "Brak rekordów MX",
        },
    }
    passed = sum(1 for c in checks.values() if c["ok"])
    return {
        "domain": domain,
        "checks": checks,
        "score": passed,
        "max_score": len(checks),
        "healthy": passed == len(checks),
    }
