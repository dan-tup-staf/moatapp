"""ICP (Ideal Customer Profile) generator.

Flow:
  1. Scrape company URL → extract title/description/main text
  2. Ask Claude to generate 4 clarifying questions
  3. After user answers → ask Claude to synthesize structured ICP fields

Requires ANTHROPIC_API_KEY. Functions raise RuntimeError with a user-friendly
message if the key is missing — handled at the route layer.
"""

import json
import logging
import re

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.icp_profile import IcpProfile
from app.schemas.icp import IcpFieldsUpdate, QAPair

logger = logging.getLogger(__name__)


class AnthropicNotConfigured(RuntimeError):
    pass


def _require_key() -> str:
    if not settings.anthropic_api_key:
        raise AnthropicNotConfigured(
            "ANTHROPIC_API_KEY not set — configure in .env to use ICP features"
        )
    return settings.anthropic_api_key


# ---------- Scraping ----------


_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
    ),
    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "sec-ch-ua": (
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
    ),
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Cache-Control": "max-age=0",
}


async def scrape_company_site(url: str) -> str:
    """Fetch URL, extract title + meta description + first ~2000 chars of
    visible text. Handles malformed HTML, timeouts, 4xx/5xx gracefully.
    Uwaga: strony z Cloudflare Bot Fight Mode (JS challenge) i tak
    zwrócą 403 — user dostaje fallback do ręcznego opisu."""
    async with httpx.AsyncClient(
        timeout=15,
        follow_redirects=True,
        headers=_BROWSER_HEADERS,
    ) as client:
        try:
            r = await client.get(url)
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise RuntimeError(f"Nie udało się pobrać strony: {e}") from e

    soup = BeautifulSoup(r.text, "html.parser")

    parts: list[str] = []
    if soup.title and soup.title.string:
        parts.append(f"TITLE: {soup.title.string.strip()}")

    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        parts.append(f"META: {meta_desc['content'].strip()}")

    og_desc = soup.find("meta", attrs={"property": "og:description"})
    if og_desc and og_desc.get("content"):
        parts.append(f"OG: {og_desc['content'].strip()}")

    # Strip script/style, collapse whitespace
    for s in soup(["script", "style", "noscript", "nav", "footer"]):
        s.decompose()
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)[:2500]
    parts.append(f"BODY: {text}")

    return "\n\n".join(parts)


# ---------- Claude calls ----------


async def generate_questions(scraped: str) -> list[str]:
    """Ask Claude for 4 clarifying questions based on scraped company info."""
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=_require_key())
    msg = await client.messages.create(
        model=settings.anthropic_model_fast,
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": (
                    "Jesteś doradcą GTM. Na podstawie poniższego opisu firmy "
                    "wygeneruj 4 precyzyjne pytania, które pomogą określić "
                    "Ideal Customer Profile (ICP) tej firmy. Każde pytanie "
                    "maksymalnie 1 zdanie, konkretne (branża / wielkość klienta / "
                    "rola buyer persona / trigger zakupowy).\n\n"
                    "Zwróć tylko JSON array 4 stringów, bez żadnych dodatków.\n\n"
                    f"OPIS FIRMY:\n{scraped[:3000]}"
                ),
            }
        ],
    )
    text = _extract_text(msg)
    return _parse_json_list(text, "pytania")


async def synthesize_icp(
    scraped: str, qa: list[QAPair]
) -> dict:
    """Synthesize structured ICP from scraped text + Q&A history."""
    from anthropic import AsyncAnthropic

    qa_block = "\n".join(
        f"Q: {p.question}\nA: {p.answer}" for p in qa if p.answer.strip()
    )
    client = AsyncAnthropic(api_key=_require_key())
    msg = await client.messages.create(
        model=settings.anthropic_model_quality,
        max_tokens=1500,
        messages=[
            {
                "role": "user",
                "content": (
                    "Na podstawie opisu firmy i odpowiedzi founderów stwórz "
                    "Ideal Customer Profile (ICP). Zwróć TYLKO poprawny JSON "
                    "ze schematem:\n"
                    "{\n"
                    '  "target_industries": [string, string, ...],\n'
                    '  "company_size": string (np. "50-500 pracowników"),\n'
                    '  "buyer_persona_titles": [string, string, ...],\n'
                    '  "pain_points": [string, string, ...],\n'
                    '  "triggers": [string, string, ...] (sygnały kupowe, np. '
                    '"rekrutacja HR managera"),\n'
                    '  "notes": string (krótkie dodatkowe wskazówki)\n'
                    "}\n\n"
                    "Każda lista 3-6 elementów, konkretne, bez ogólników.\n\n"
                    f"OPIS FIRMY:\n{scraped[:3000]}\n\n"
                    f"PYTANIA I ODPOWIEDZI:\n{qa_block or '(brak)'}"
                ),
            }
        ],
    )
    text = _extract_text(msg)
    return _parse_json_dict(text, "ICP")


def _extract_text(msg) -> str:
    for block in msg.content:
        if hasattr(block, "text"):
            return block.text
    return ""


_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)


def _unwrap_json(text: str) -> str:
    """Claude sometimes wraps JSON in ```json ... ``` even when asked not to."""
    m = _JSON_BLOCK_RE.search(text)
    return m.group(1) if m else text.strip()


def _parse_json_list(text: str, what: str) -> list[str]:
    try:
        data = json.loads(_unwrap_json(text))
        if not isinstance(data, list):
            raise ValueError(f"oczekiwano listy, dostałem {type(data).__name__}")
        return [str(x).strip() for x in data if str(x).strip()]
    except (json.JSONDecodeError, ValueError) as e:
        logger.exception("Claude zwrócił niepoprawny JSON dla %s: %s", what, text)
        raise RuntimeError(f"Claude zwrócił niepoprawny format dla {what}") from e


def _parse_json_dict(text: str, what: str) -> dict:
    try:
        data = json.loads(_unwrap_json(text))
        if not isinstance(data, dict):
            raise ValueError(f"oczekiwano obiektu, dostałem {type(data).__name__}")
        return data
    except (json.JSONDecodeError, ValueError) as e:
        logger.exception("Claude zwrócił niepoprawny JSON dla %s: %s", what, text)
        raise RuntimeError(f"Claude zwrócił niepoprawny format dla {what}") from e


# ---------- Persistence ----------


async def get_or_none(
    db: AsyncSession, user_id: int
) -> IcpProfile | None:
    stmt = select(IcpProfile).where(IcpProfile.user_id == user_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def upsert_after_analysis(
    db: AsyncSession,
    user_id: int,
    url: str,
    scraped: str,
    questions: list[str],
) -> IcpProfile:
    """Called after first URL analysis — stores scraped_summary + questions
    as qa_history (with empty answers)."""
    obj = await get_or_none(db, user_id)
    qa_history = [{"question": q, "answer": ""} for q in questions]
    if obj is None:
        obj = IcpProfile(
            user_id=user_id,
            source_url=url,
            scraped_summary=scraped,
            qa_history=qa_history,
            icp_fields={},
        )
        db.add(obj)
    else:
        obj.source_url = url
        obj.scraped_summary = scraped
        obj.qa_history = qa_history
        obj.icp_fields = {}  # reset — new company
    await db.commit()
    await db.refresh(obj)
    return obj


async def upsert_after_synthesis(
    db: AsyncSession,
    user_id: int,
    qa: list[QAPair],
    icp_fields: dict,
) -> IcpProfile:
    obj = await get_or_none(db, user_id)
    if obj is None:
        # Shouldn't happen — synthesize expects analyze first
        raise RuntimeError("Najpierw przeanalizuj URL strony firmy")
    obj.qa_history = [p.model_dump() for p in qa]
    obj.icp_fields = icp_fields
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_fields(
    db: AsyncSession, user_id: int, update: IcpFieldsUpdate
) -> IcpProfile | None:
    obj = await get_or_none(db, user_id)
    if obj is None:
        return None
    current = dict(obj.icp_fields or {})
    data = update.model_dump(exclude_unset=True)
    current.update(data)
    obj.icp_fields = current
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_for_user(db: AsyncSession, user_id: int) -> bool:
    obj = await get_or_none(db, user_id)
    if obj is None:
        return False
    await db.delete(obj)
    await db.commit()
    return True
