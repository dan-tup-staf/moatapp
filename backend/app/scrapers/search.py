"""Unified general web search for signal channels.

Provider preference:
  1. Brave Search API   (settings.brave_api_key)   — reliable, no rate-limit
  2. SerpAPI (Google)   (settings.serpapi_key)
  3. DuckDuckGo HTML    (free, no key)              — fallback

All return a normalized list of {title, url, summary}. A configured provider
that errors or returns nothing falls through to DuckDuckGo so a source always
gets a real attempt.
"""

import logging

import httpx

from app.config import settings
from app.scrapers.ddg import ddg_results

logger = logging.getLogger(__name__)


def active_provider() -> str:
    if settings.brave_api_key:
        return "brave"
    if settings.serpapi_key:
        return "serpapi"
    return "duckduckgo"


async def _brave(query: str, max_results: int) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={
                    "q": query,
                    "country": "PL",
                    "search_lang": "pl",
                    "count": min(max_results, 20),
                },
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": settings.brave_api_key,
                },
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("Brave search failed: %s", e)
        return []
    if r.status_code != 200:
        logger.warning("Brave returned %s: %s", r.status_code, r.text[:200])
        return []
    results = (r.json().get("web") or {}).get("results") or []
    return [
        {
            "title": it.get("title") or "",
            "url": it.get("url") or "",
            "summary": it.get("description") or "",
        }
        for it in results
        if it.get("url")
    ][:max_results]


async def _serpapi(query: str, max_results: int) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.get(
                "https://serpapi.com/search.json",
                params={
                    "q": query,
                    "engine": "google",
                    "google_domain": "google.pl",
                    "gl": "pl",
                    "hl": "pl",
                    "num": min(max_results, 20),
                    "api_key": settings.serpapi_key,
                },
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("SerpAPI search failed: %s", e)
        return []
    if r.status_code != 200:
        logger.warning("SerpAPI returned %s: %s", r.status_code, r.text[:200])
        return []
    results = r.json().get("organic_results") or []
    return [
        {
            "title": it.get("title") or "",
            "url": it.get("link") or "",
            "summary": it.get("snippet") or "",
        }
        for it in results
        if it.get("link")
    ][:max_results]


async def web_search(query: str, max_results: int = 15) -> list[dict]:
    """Return [{title, url, summary}] from the best available provider."""
    provider = active_provider()
    results: list[dict] = []
    if provider == "brave":
        results = await _brave(query, max_results)
    elif provider == "serpapi":
        results = await _serpapi(query, max_results)
    if results:
        return results
    # Free fallback (or the default when no key is configured).
    return await ddg_results(query, max_results)
