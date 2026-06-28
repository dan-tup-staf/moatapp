"""Shared DuckDuckGo HTML search — real general web results, no API key.

Used by the web_search channels and as a resilience fallback for site-specific
scrapers (e.g. pracuj.pl) when their primary parse breaks.
"""

import logging
import urllib.parse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_DDG = "https://html.duckduckgo.com/html/"
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


async def ddg_results(query: str, max_results: int = 15) -> list[dict]:
    """Return [{title, url, summary}] for a query, or [] on failure."""
    try:
        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
            headers={"User-Agent": _UA, "Accept-Language": "pl-PL,pl;q=0.9"},
        ) as client:
            r = await client.post(_DDG, data={"q": query, "kl": "pl-pl"})
    except Exception as e:  # noqa: BLE001
        logger.warning("DDG search failed for %r: %s", query, e)
        return []
    if r.status_code != 200:
        logger.warning("DDG returned %s for %r", r.status_code, query)
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    out: list[dict] = []
    for res in soup.select("div.result")[: max_results * 2]:
        a = res.select_one("a.result__a")
        if a is None:
            continue
        title = a.get_text(strip=True)
        href = a.get("href") or ""
        if "uddg=" in href:
            try:
                href = urllib.parse.parse_qs(
                    urllib.parse.urlparse(href).query
                )["uddg"][0]
            except Exception:  # noqa: BLE001
                pass
        if not title or not href.startswith("http"):
            continue
        snippet_el = res.select_one(".result__snippet")
        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
        out.append({"title": title, "url": href, "summary": snippet})
        if len(out) >= max_results:
            break
    return out
