from app.scrapers.base import BaseScraper, ScrapedSignal
from app.scrapers.pracuj import PracujScraper
from app.scrapers.rss import RssScraper

# Registry: SignalSource.type → scraper instance
SCRAPERS: dict[str, BaseScraper] = {
    "rss": RssScraper(),
    "pracuj_pl": PracujScraper(),
}

__all__ = [
    "BaseScraper",
    "ScrapedSignal",
    "RssScraper",
    "PracujScraper",
    "SCRAPERS",
]
