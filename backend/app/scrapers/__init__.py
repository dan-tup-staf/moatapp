from app.scrapers.base import BaseScraper, ScrapedSignal
from app.scrapers.rss import RssScraper

# Registry: SignalSource.type → scraper instance
SCRAPERS: dict[str, BaseScraper] = {
    "rss": RssScraper(),
}

__all__ = ["BaseScraper", "ScrapedSignal", "RssScraper", "SCRAPERS"]
