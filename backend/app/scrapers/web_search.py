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


_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


class WebSearchScraper(BaseScraper):
    """Collects REAL signals — no API key, reachable from the server.

    - `google_news` → Google News RSS search (recent real articles).
    - everything else (serp / linkedin / x_twitter / funding / company_site)
      → real general web search via DuckDuckGo's HTML endpoint, preserving the
      channel's `site:` filters so e.g. the `funding` channel hits Crunchbase/
      Dealroom and `serp` hits registries (KRS/MSiG). Falls back to Google News
      RSS when DDG returns nothing.

    Replaced the LLM-grounded approach, which was unreliable (Gemini grounding
    returned empty responses).
    """

    _RSS = "https://news.google.com/rss/search"
    _DDG = "https://html.duckduckgo.com/html/"

    def __init__(self, channel: str) -> None:
        if channel not in CHANNELS:
            raise ValueError(f"Unknown web_search channel: {channel}")
        self.channel = channel
        self.meta = CHANNELS[channel]

    async def fetch(self, config: dict[str, Any]) -> list[ScrapedSignal]:
        query = (config.get("query") or "").strip()
        if not query:
            return []
        company_domain = (config.get("company_domain") or "").strip() or None
        max_results = int(config.get("max_results", 15))

        if self.channel == "google_news":
            return await self._google_news(query, company_domain, max_results)

        # General web search with the channel's site: scoping.
        sites = list(self.meta.get("sites") or [])
        if self.channel == "company_site" and company_domain:
            sites = [company_domain]
        site_filter = (
            " (" + " OR ".join(f"site:{s}" for s in sites) + ")" if sites else ""
        )
        ddg = await self._ddg(f"{query}{site_filter}", company_domain, max_results)
        if ddg:
            return ddg
        # Nothing on the open web → fall back to real news so the source still
        # produces signals.
        return await self._google_news(query, company_domain, max_results)

    async def _google_news(
        self, query: str, company_domain: str | None, max_results: int
    ) -> list[ScrapedSignal]:
        import asyncio
        import urllib.parse

        import feedparser

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
            source = ""
            if " - " in title:
                title_clean, source = title.rsplit(" - ", 1)
                title = title_clean.strip() or title
            signals.append(
                ScrapedSignal(
                    title=title[:512],
                    url=(entry.get("link") or None),
                    company_domain=company_domain,
                    payload={
                        "summary": (entry.get("summary") or "")[:1000],
                        "published": entry.get("published"),
                        "channel": self.channel,
                        "source": source or "Google News",
                        "search_query": query,
                    },
                )
            )
        return signals

    async def _ddg(
        self, query: str, company_domain: str | None, max_results: int
    ) -> list[ScrapedSignal]:
        from app.scrapers.ddg import ddg_results

        results = await ddg_results(query, max_results)
        return [
            ScrapedSignal(
                title=r["title"][:512],
                url=r["url"],
                company_domain=company_domain,
                payload={
                    "summary": r["summary"][:1000],
                    "channel": self.channel,
                    "source": "DuckDuckGo",
                    "search_query": query,
                },
            )
            for r in results
        ]
