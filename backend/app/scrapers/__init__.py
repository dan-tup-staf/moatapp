from app.scrapers.base import BaseScraper, ScrapedSignal
from app.scrapers.pracuj import PracujScraper
from app.scrapers.rss import RssScraper
from app.scrapers.web_search import CHANNELS as WEB_SEARCH_CHANNELS
from app.scrapers.web_search import WebSearchScraper

# Registry: SignalSource.type → scraper instance
SCRAPERS: dict[str, BaseScraper] = {
    "rss": RssScraper(),
    "pracuj_pl": PracujScraper(),
    **{channel: WebSearchScraper(channel) for channel in WEB_SEARCH_CHANNELS},
}

__all__ = [
    "BaseScraper",
    "ScrapedSignal",
    "RssScraper",
    "PracujScraper",
    "WebSearchScraper",
    "WEB_SEARCH_CHANNELS",
    "SCRAPERS",
]
