import asyncio
from typing import Any

import feedparser

from app.scrapers.base import BaseScraper, ScrapedSignal


class RssScraper(BaseScraper):
    """Generic RSS/Atom feed scraper. Each entry becomes one signal.

    config schema:
        feed_url:        str (required) — URL of the RSS/Atom feed
        company_domain:  str (optional) — domain to tag every signal with,
                                          used for lead linking
        max_entries:     int (optional, default 50) — limit per fetch
    """

    async def fetch(self, config: dict[str, Any]) -> list[ScrapedSignal]:
        feed_url = config.get("feed_url")
        if not feed_url:
            return []
        company_domain = config.get("company_domain")
        max_entries = int(config.get("max_entries", 50))

        # feedparser is sync — push to thread so we don't block the worker.
        loop = asyncio.get_event_loop()
        feed = await loop.run_in_executor(None, feedparser.parse, feed_url)

        signals: list[ScrapedSignal] = []
        for entry in feed.entries[:max_entries]:
            title = (entry.get("title") or "(no title)")[:500]
            link = entry.get("link")
            summary = (entry.get("summary") or "")[:1000]
            published = entry.get("published")
            signals.append(
                ScrapedSignal(
                    title=title,
                    url=link,
                    company_domain=company_domain,
                    payload={
                        "summary": summary,
                        "published": published,
                    },
                )
            )
        return signals
