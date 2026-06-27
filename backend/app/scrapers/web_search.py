"""Generic web-search-backed signal scraper.

Uses Claude's server-side `web_search` tool to find recent items matching a
query, optionally constrained to a channel (via `site:` filters). This works
around Cloudflare / anti-bot protection on LinkedIn, X/Twitter, news portals,
funding databases etc. — the searches run on Anthropic's infrastructure, not
from our IP.

One class, parametrized by `channel`. The registry in `scrapers/__init__.py`
registers one instance per channel so each `SignalSource.type` maps cleanly.

config schema (per source):
    query:          str (required) — what to search for
    company_domain: str (optional) — tag every signal for lead-linking; for the
                                     `company_site` channel it also scopes the
                                     search to that domain
    max_results:    int (optional, default 15)

Requires an AI provider (GEMINI_API_KEY or ANTHROPIC_API_KEY). If missing,
`fetch` raises RuntimeError which `services.signals.run_source` captures into
`source.last_error`. Provider selection lives in `app.llm`.
"""

import json
import logging
import re
from typing import Any

from app import llm
from app.scrapers.base import BaseScraper, ScrapedSignal

logger = logging.getLogger(__name__)


# channel -> search behaviour. `sites` are appended as `site:` filters;
# `hint` steers Claude on what kind of items count as a signal.
CHANNELS: dict[str, dict[str, Any]] = {
    "linkedin": {
        "label": "LinkedIn",
        "sites": ["linkedin.com"],
        "hint": (
            "posty, ogłoszenia o pracy, zmiany stanowisk (nowy CFO/CISO/"
            "Country Manager), aktualizacje firmowe i fale rekrutacji GTM"
        ),
    },
    "google_news": {
        "label": "Google News",
        "sites": [],
        "hint": (
            "artykuły prasowe i komunikaty (Puls Biznesu, MyCompany Polska, "
            "ITwiz, CRN Polska, Bankier, mamstartup.pl) — newsy o firmach"
        ),
    },
    "x_twitter": {
        "label": "X / Twitter",
        "sites": ["x.com", "twitter.com"],
        "hint": "wpisy, zapowiedzi, dyskusje branżowe",
    },
    "serp": {
        "label": "SERP (ogólne wyszukiwanie)",
        "sites": [],
        "hint": (
            "dowolne wyniki wyszukiwania — rejestry (KRS/RDF/MSiG/Rejestr "
            "Zastawów), BIP-y stref ekonomicznych, listy beneficjentów grantów"
        ),
    },
    "funding": {
        "label": "Bazy fundingowe",
        "sites": [
            "crunchbase.com",
            "dealroom.co",
            "pitchbook.com",
            "mamstartup.pl",
            "pfr.pl",
        ],
        "hint": "rundy finansowania, inwestycje VC/PE, granty (NCBR/PARP), M&A",
    },
    "company_site": {
        "label": "Strona firmowa",
        "sites": [],  # scoped to config.company_domain at runtime
        "hint": "nowości, komunikaty prasowe, ogłoszenia i zmiany na stronie firmy",
    },
}


_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)
_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)


class WebSearchScraper(BaseScraper):
    def __init__(self, channel: str) -> None:
        if channel not in CHANNELS:
            raise ValueError(f"Unknown web_search channel: {channel}")
        self.channel = channel
        self.meta = CHANNELS[channel]

    async def fetch(self, config: dict[str, Any]) -> list[ScrapedSignal]:
        query = (config.get("query") or "").strip()
        if not query:
            return []
        if not llm.is_configured():
            raise RuntimeError(
                "Brak klucza AI (GEMINI_API_KEY lub ANTHROPIC_API_KEY) — kanały "
                "oparte o web_search wymagają skonfigurowanego dostawcy AI"
            )

        company_domain = (config.get("company_domain") or "").strip() or None
        max_results = int(config.get("max_results", 15))

        sites = list(self.meta["sites"])
        if self.channel == "company_site" and company_domain:
            sites = [company_domain]
        site_filter = (
            " (" + " OR ".join(f"site:{s}" for s in sites) + ")" if sites else ""
        )
        full_query = f"{query}{site_filter}"

        raw = await self._search(full_query, max_results)
        items = self._parse_items(raw)

        signals: list[ScrapedSignal] = []
        for it in items[:max_results]:
            title = (it.get("title") or "").strip()
            if not title:
                continue
            payload = {
                "summary": (it.get("summary") or "")[:1000],
                "published": it.get("published"),
                "channel": self.channel,
                "search_query": query,
            }
            cname = (it.get("company_name") or "").strip()
            if cname:
                payload["company_name"] = cname
            signals.append(
                ScrapedSignal(
                    title=title[:512],
                    url=(it.get("url") or None),
                    company_domain=(it.get("company_domain") or company_domain),
                    payload=payload,
                )
            )
        return signals

    async def _search(self, query: str, max_results: int) -> str:
        label = self.meta["label"]
        hint = self.meta["hint"]
        prompt = (
            f"Jesteś silnikiem sygnałów zakupowych (intent data) "
            f"dla polskiego B2B. Kanał: {label}.\n\n"
            f"Wyszukaj w internecie NAJNOWSZE (preferuj ostatnie "
            f"30-90 dni) wyniki dla zapytania:\n{query}\n\n"
            f"Interesują nas: {hint}.\n\n"
            f"Zwróć maksymalnie {max_results} pozycji jako "
            f"WYŁĄCZNIE poprawny JSON array obiektów:\n"
            "[{\n"
            '  "title": string,        // krótki tytuł sygnału\n'
            '  "url": string|null,      // link do źródła\n'
            '  "company_name": string|null, // firma której dotyczy\n'
            '  "company_domain": string|null, // domena firmy jeśli znana\n'
            '  "summary": string,       // 1-2 zdania po polsku\n'
            '  "published": string|null // data publikacji jeśli znana\n'
            "}]\n\n"
            "Bez komentarzy, bez markdown — sam JSON array. Jeśli "
            "nic nie znajdziesz, zwróć []. Nie zmyślaj firm ani "
            "linków."
        )
        try:
            # Generous budget: grounded models spend output tokens on internal
            # reasoning, so a tight cap can yield an empty (MAX_TOKENS) result.
            return await llm.web_search_text(prompt, max_tokens=4000)
        except Exception as e:
            logger.exception("web_search (%s) failed for %r", self.channel, query)
            raise RuntimeError(
                f"web_search nie powiódł się: {type(e).__name__}: {e}"
            ) from e

    def _parse_items(self, text: str) -> list[dict]:
        if not text:
            return []
        candidate = text
        m = _JSON_BLOCK_RE.search(text)
        if m:
            candidate = m.group(1)
        else:
            arr = _JSON_ARRAY_RE.search(text)
            if arr:
                candidate = arr.group(0)
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            logger.warning(
                "web_search (%s) zwrócił niepoprawny JSON: %s",
                self.channel,
                text[:300],
            )
            return []
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict)]
