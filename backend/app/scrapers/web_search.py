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

import logging
from typing import Any

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


class WebSearchScraper(BaseScraper):
    """Collects REAL signals from Google News RSS search.

    Google News exposes a public RSS search endpoint that returns recent, real
    articles matching a query — no API key, deterministic, and reachable from
    the server. This replaced the LLM-grounded approach, which was unreliable
    (Gemini grounding often returned an empty response). For the `company_site`
    channel we add a `site:` filter to scope to the company's domain.
    """

    _RSS = "https://news.google.com/rss/search"

    def __init__(self, channel: str) -> None:
        if channel not in CHANNELS:
            raise ValueError(f"Unknown web_search channel: {channel}")
        self.channel = channel
        self.meta = CHANNELS[channel]

    async def fetch(self, config: dict[str, Any]) -> list[ScrapedSignal]:
        import asyncio
        import urllib.parse

        import feedparser

        query = (config.get("query") or "").strip()
        if not query:
            return []
        company_domain = (config.get("company_domain") or "").strip() or None
        max_results = int(config.get("max_results", 15))

        q = query
        if self.channel == "company_site" and company_domain:
            q = f"{query} site:{company_domain}"

        url = (
            self._RSS
            + "?"
            + urllib.parse.urlencode(
                {"q": q, "hl": "pl", "gl": "PL", "ceid": "PL:pl"}
            )
        )

        loop = asyncio.get_event_loop()
        feed = await loop.run_in_executor(None, feedparser.parse, url)

        signals: list[ScrapedSignal] = []
        for entry in feed.entries[:max_results]:
            title = (entry.get("title") or "").strip()
            if not title:
                continue
            # Google News titles end with " - <Source>".
            source = ""
            if " - " in title:
                title_clean, source = title.rsplit(" - ", 1)
                title = title_clean.strip() or title
            payload = {
                "summary": (entry.get("summary") or "")[:1000],
                "published": entry.get("published"),
                "channel": self.channel,
                "source": source,
                "search_query": query,
            }
            signals.append(
                ScrapedSignal(
                    title=title[:512],
                    url=(entry.get("link") or None),
                    company_domain=company_domain,
                    payload=payload,
                )
            )
        return signals
