from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ScrapedSignal:
    """A normalized intent signal as returned by a scraper. The service layer
    is responsible for persisting + linking these to leads."""

    title: str
    url: str | None = None
    company_domain: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


class BaseScraper(ABC):
    """All scrapers implement an async `fetch(config)` that returns a list of
    `ScrapedSignal`. They should not touch the DB — persistence and linking
    happens in `services.signals.run_source`."""

    @abstractmethod
    async def fetch(self, config: dict[str, Any]) -> list[ScrapedSignal]:
        ...
