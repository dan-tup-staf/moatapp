"""ICP (Ideal Customer Profile) generator.

Flow:
  1. Ask Claude (with web_search tool) to research the company → 200-300 word summary
  2. Ask Claude to generate 4 clarifying questions based on that summary
  3. After user answers → ask Claude to synthesize structured ICP fields

Requires ANTHROPIC_API_KEY. Functions raise RuntimeError with a user-friendly
message if the key is missing — handled at the route layer.

Why LLM research not httpx scraping: Polish B2B sites (staffly.pl and many
others) use Cloudflare Bot Fight Mode and block httpx with 403. Claude's
server-side web_search bypasses this — search + synthesis happen on Anthropic's
infra. Manual description path stays as fallback for fully-private sites.
"""

import json
import logging
import re

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


# ---------- Company research (LLM + web_search) ----------


async def research_company_with_llm(url: str) -> str:
    """Research a company by URL using Claude + server-side web_search tool.
    Replaces the legacy httpx scraping path — works around Cloudflare bot
    protection because searches happen on Anthropic's infrastructure.

    Returns 200-300 word Polish summary ready for question generation."""
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=_require_key())
    try:
        response = await client.messages.create(
            model=settings.anthropic_model_fast,
            max_tokens=1500,
            tools=[{"type": "web_search_20260209", "name": "web_search"}],
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Zbadaj firmę pod tym URL: {url}\n\n"
                        "Wyszukaj w internecie (strona, LinkedIn, news, "
                        "katalogi firm) i zwróć 200-300 słów po polsku w "
                        "strukturze:\n"
                        "- Co firma robi (produkt/usługa)\n"
                        "- Branża i target market\n"
                        "- Wielkość firmy jeśli możliwa do ustalenia\n"
                        "- Kluczowe oferty / flagowe produkty\n"
                        "- Typowi klienci / buyer persona\n\n"
                        "Konkretnie, bez marketingowych ozdobników. Jeśli nie "
                        "znajdziesz jakiejś informacji — napisz wprost czego "
                        "brakuje, nie zmyślaj."
                    ),
                }
            ],
        )
    except Exception as e:
        logger.exception("Claude research failed for %s", url)
        raise RuntimeError(
            f"Claude research nie powiodł się: {type(e).__name__}: {e}"
        ) from e

    # Response ma interleaved blocks:
    # [text (opt. "Będę szukać..."), server_tool_use, web_search_tool_result, text (synthesis)]
    # Zbieramy wszystkie text blocks; final synthesis jest ostatni.
    texts = [
        b.text.strip() for b in response.content if b.type == "text" and b.text.strip()
    ]
    if not texts:
        raise RuntimeError(
            "Claude nie zwrócił tekstu — prawdopodobnie web_search nie "
            "znalazł nic o tej firmie. Uzyj opcji Opis reczny."
        )
    return "\n\n".join(texts)


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
