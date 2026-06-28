"""Pracuj.pl scraper.

Strategy: pracuj.pl is a Next.js SSR app. The search results page embeds the
React Query cache as a JSON blob inside `__NEXT_DATA__`. We hit the same
public search URL a browser would, parse the embedded JSON, and pull the
`groupedOffers` array from the `jobOffers` query — no headless browser, no
official API.

Each grouped offer can have multiple sub-offers (one per location for the
same role). We emit one ScrapedSignal per sub-offer so each gets its own URL
for dedup via the source_id+url unique constraint.

Lead linking: pracuj.pl exposes only a `companyProfileAbsoluteUri` pointing
back to pracodawcy.pracuj.pl (not the company's own domain), so we cannot
populate `company_domain`. Instead we put `company_name` in `payload` and
rely on the company-name fuzzy match path in services/signals.py.
"""

import json
import logging
import re
from typing import Any
from urllib.parse import quote

import httpx

from app.scrapers.base import BaseScraper, ScrapedSignal

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.pracuj.pl"
_NEXT_DATA_RE = re.compile(
    r'__NEXT_DATA__"\s+type="application/json">([^<]+)</script>'
)
_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class PracujScraper(BaseScraper):
    """Scrapes pracuj.pl job offers by keyword.

    config schema:
        keywords: list[str] | str (required) — search terms; one search per item
        max_per_keyword: int (optional, default 50, capped at 50 per page)
    """

    async def fetch(self, config: dict[str, Any]) -> list[ScrapedSignal]:
        raw_keywords = config.get("keywords") or []
        if isinstance(raw_keywords, str):
            keywords = [raw_keywords]
        else:
            keywords = [str(k).strip() for k in raw_keywords if str(k).strip()]
        if not keywords:
            return []

        max_per_keyword = int(config.get("max_per_keyword", 50))

        signals: list[ScrapedSignal] = []
        async with httpx.AsyncClient(
            timeout=20, follow_redirects=True, headers=_DEFAULT_HEADERS
        ) as client:
            for kw in keywords:
                try:
                    offers = await self._fetch_offers(client, kw)
                except Exception:
                    logger.exception("pracuj.pl fetch failed for keyword %r", kw)
                    offers = []
                for off in offers[:max_per_keyword]:
                    signals.extend(self._offer_to_signals(off, kw))

        # Resilience: if pracuj.pl changed its markup / blocked us and we got
        # nothing, fall back to real DuckDuckGo results scoped to pracuj.pl so
        # the source still surfaces live job-posting links.
        if not signals:
            signals = await self._ddg_fallback(keywords, max_per_keyword)
        return signals

    async def _ddg_fallback(
        self, keywords: list[str], limit: int
    ) -> list[ScrapedSignal]:
        from app.scrapers.search import web_search

        out: list[ScrapedSignal] = []
        for kw in keywords:
            results = await web_search(
                f"{kw} praca site:pracuj.pl", min(limit, 20)
            )
            for r in results:
                out.append(
                    ScrapedSignal(
                        title=r["title"][:512],
                        url=r["url"],
                        company_domain=None,
                        payload={
                            "summary": r["summary"][:1000],
                            "source": "pracuj.pl (DDG)",
                            "search_keyword": kw,
                        },
                    )
                )
        return out

    async def _fetch_offers(
        self, client: httpx.AsyncClient, keyword: str
    ) -> list[dict]:
        url = f"{_BASE_URL}/praca/{quote(keyword)};kw"
        r = await client.get(url)
        if r.status_code != 200:
            logger.warning(
                "pracuj.pl returned %s for keyword %r", r.status_code, keyword
            )
            return []

        m = _NEXT_DATA_RE.search(r.text)
        if not m:
            logger.warning("pracuj.pl __NEXT_DATA__ not found for %r", keyword)
            return []

        try:
            payload = json.loads(m.group(1))
        except json.JSONDecodeError:
            logger.exception("pracuj.pl __NEXT_DATA__ JSON parse failed")
            return []

        try:
            queries = payload["props"]["pageProps"]["dehydratedState"]["queries"]
        except (KeyError, TypeError):
            return []

        for q in queries:
            qkey = q.get("queryKey") or []
            if qkey and qkey[0] == "jobOffers":
                data = q.get("state", {}).get("data") or {}
                return list(data.get("groupedOffers") or [])
        return []

    def _offer_to_signals(
        self, offer: dict, keyword: str
    ) -> list[ScrapedSignal]:
        company_name = (offer.get("companyName") or "").strip()
        job_title = (offer.get("jobTitle") or "(no title)").strip()

        # Trim long fields to fit DB columns
        title_full = f"{job_title} — {company_name}" if company_name else job_title

        base_payload = {
            "company_name": company_name,
            "company_id": offer.get("companyId"),
            "company_profile": offer.get("companyProfileAbsoluteUri"),
            "company_logo": offer.get("companyLogoUri"),
            "position_levels": offer.get("positionLevels") or [],
            "work_modes": offer.get("workModes") or [],
            "contract_types": offer.get("typesOfContract") or [],
            "schedules": offer.get("workSchedules") or [],
            "last_publicated": offer.get("lastPublicated"),
            "expiration_date": offer.get("expirationDate"),
            "ai_summary": offer.get("aiSummary"),
            "job_description_preview": (offer.get("jobDescription") or "")[:1000],
            "search_keyword": keyword,
        }

        sub_offers = offer.get("offers") or []
        if not sub_offers:
            # Some offers can lack sub-offers; emit one signal with no URL
            return [
                ScrapedSignal(
                    title=title_full,
                    url=None,
                    company_domain=None,
                    payload=base_payload,
                )
            ]

        signals: list[ScrapedSignal] = []
        for sub in sub_offers:
            payload = {
                **base_payload,
                "workplace": sub.get("displayWorkplace"),
                "is_whole_poland": sub.get("isWholePoland", False),
                "partition_id": sub.get("partitionId"),
            }
            workplace = sub.get("displayWorkplace")
            display_title = (
                f"{title_full} ({workplace})" if workplace else title_full
            )
            signals.append(
                ScrapedSignal(
                    title=display_title,
                    url=sub.get("offerAbsoluteUri"),
                    company_domain=None,
                    payload=payload,
                )
            )
        return signals
