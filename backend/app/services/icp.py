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

from app import llm
from app.models.icp_profile import IcpProfile
from app.schemas.icp import IcpFieldsUpdate, QAPair

logger = logging.getLogger(__name__)

# Kept as an alias for backward compatibility: the route layer catches
# `AnthropicNotConfigured`. The provider-agnostic layer raises LlmNotConfigured
# (covers both Gemini and Anthropic), so aliasing keeps existing `except`
# clauses working without change.
AnthropicNotConfigured = llm.LlmNotConfigured


# ---------- Company research (LLM + web search) ----------


async def research_company_with_llm(url: str) -> str:
    """Research a company by URL using the configured AI provider with web
    search (Gemini Google Search grounding, or Anthropic web_search). Works
    around Cloudflare bot protection because searches run provider-side.

    Returns 200-300 word Polish summary ready for question generation."""
    prompt = (
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
    )
    try:
        text = await llm.web_search_text(prompt, max_tokens=1500)
    except llm.LlmNotConfigured:
        raise
    except Exception as e:
        logger.exception("Company research failed for %s", url)
        raise RuntimeError(
            f"Research firmy nie powiódł się: {type(e).__name__}: {e}"
        ) from e

    if not text.strip():
        raise RuntimeError(
            "AI nie zwrócił tekstu — prawdopodobnie wyszukiwarka nie "
            "znalazła nic o tej firmie. Użyj opcji Opis ręczny."
        )
    return text


# ---------- LLM calls ----------


async def generate_questions(scraped: str) -> list[str]:
    """Ask the AI for 4 clarifying questions based on scraped company info."""
    prompt = (
        "Jesteś doradcą GTM. Na podstawie poniższego opisu firmy "
        "wygeneruj 4 precyzyjne pytania, które pomogą określić "
        "Ideal Customer Profile (ICP) tej firmy. Każde pytanie "
        "maksymalnie 1 zdanie, konkretne (branża / wielkość klienta / "
        "rola buyer persona / trigger zakupowy).\n\n"
        "Zwróć tylko JSON array 4 stringów, bez żadnych dodatków.\n\n"
        f"OPIS FIRMY:\n{scraped[:3000]}"
    )
    text = await llm.generate_text(prompt, max_tokens=500)
    return _parse_json_list(text, "pytania")


async def synthesize_icp(
    scraped: str, qa: list[QAPair]
) -> dict:
    """Synthesize structured ICP from scraped text + Q&A history."""
    qa_block = "\n".join(
        f"Q: {p.question}\nA: {p.answer}" for p in qa if p.answer.strip()
    )
    prompt = (
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
    )
    text = await llm.generate_text(prompt, max_tokens=1500, quality=True)
    return _parse_json_dict(text, "ICP")


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


# ---------- Discovery: suggest dedicated signal sources from ICP ----------

# Allowed web_search channels a suggestion can target (must match the scraper
# registry / SourceType enum). pracuj.pl and RSS stay manual — they need a
# different config shape.
_SUGGESTABLE_CHANNELS = {
    "linkedin",
    "google_news",
    "x_twitter",
    "serp",
    "funding",
    "company_site",
}

# Compact domain knowledge fed to the model so the generated queries fit the
# Polish B2B intent ecosystem instead of generic global ones.
_PL_SIGNAL_CONTEXT = """\
KONTEKST — polski ekosystem sygnałów zakupowych B2B (używaj go w zapytaniach):
- Rejestry: KRS / Portal Rejestrów Sądowych (zmiana zarządu, prokury), RDF
  (sprawozdania finansowe, capex), MSiG (połączenia/podziały/przekształcenia),
  Rejestr Zastawów (finansowanie dłużne), UPRP/EPO (patenty), BIP-y SSE.
- Giełda: raporty bieżące ESPI/EBI (zarząd, M&A, znaczące umowy), ESEF/CSRD.
- Regulacje (okna zakupowe 2026): KSeF (e-faktura, wymiana ERP), NIS2/UKSC
  (audyt, SZBI, SOC/SIEM), DORA, AI Act, CSRD, ustawa o sygnalistach.
- Nadzór: decyzje KNF, kary UODO, wystąpienia pokontrolne NIK.
- Finansowanie: rundy VC (mamstartup.pl, Puls Biznesu), granty NCBR (Szybka
  Ścieżka, Bridge Alfa) / PARP SMART.
- C-suite/rekrutacja na LinkedIn: nowy CFO/CISO/DPO/Head of AI/Country Manager,
  fala rekrutacji GTM (BDR, AE) ~90 dni po rundzie.
- Ekspansja DACH/UK/US: due diligence (ESPI), rejestracja GmbH (Bundesanzeiger)
  / UK Ltd (Companies House), Country Manager, sponsoring OMR/SaaStock/Slush.
- Media branżowe: Puls Biznesu, MyCompany Polska, ITwiz, CRN Polska, Bankier.
"""


async def suggest_signal_sources(icp: IcpProfile) -> list[dict]:
    """Given a synthesized ICP, ask the AI to propose dedicated signal sources
    (one per relevant channel) with tailored Polish-context search queries.

    Returns a list of dicts: {type, name, query, rationale, score_weight,
    max_results}. Only web_search channels are produced so each maps directly
    to a SignalSourceCreate with config {query, max_results}."""
    fields = icp.icp_fields or {}
    icp_block = json.dumps(fields, ensure_ascii=False, indent=2)
    summary = (icp.scraped_summary or "")[:2000]

    prompt = (
        "Jesteś strategiem intent-data dla polskiego B2B. Na "
        "podstawie ICP użytkownika zaproponuj 6-9 DEDYKOWANYCH "
        "źródeł sygnałów zakupowych — po jednym precyzyjnym "
        "zapytaniu na źródło.\n\n"
        f"{_PL_SIGNAL_CONTEXT}\n"
        "Dozwolone wartości pola 'type' (kanał wyszukiwania):\n"
        "- linkedin: zmiany stanowisk, role C-suite, rekrutacja GTM\n"
        "- google_news: prasa, komunikaty, ESPI/EBI, regulacje\n"
        "- serp: rejestry (KRS/RDF/MSiG/Zastawy), BIP, granty, patenty\n"
        "- funding: rundy VC/PE, NCBR/PARP, M&A\n"
        "- x_twitter: zapowiedzi i dyskusje branżowe\n"
        "- company_site: monitoring stron firm z targetu\n\n"
        "Zwróć WYŁĄCZNIE poprawny JSON array obiektów:\n"
        "[{\n"
        '  "type": string (jeden z dozwolonych),\n'
        '  "name": string (krótka nazwa źródła po polsku),\n'
        '  "query": string (gotowe zapytanie wyszukiwania, '
        "konkretne — branże/role/triggery z ICP),\n"
        '  "rationale": string (1 zdanie: dlaczego to sygnał '
        "zakupowy dla tego ICP),\n"
        '  "score_weight": int 10-50 (siła sygnału)\n'
        "}]\n\n"
        "Bez markdown, sam JSON. Dobierz kanały do ICP — nie "
        "wrzucaj wszystkiego na siłę.\n\n"
        f"ICP (pola):\n{icp_block}\n\n"
        f"OPIS FIRMY UŻYTKOWNIKA:\n{summary}"
    )
    try:
        text = await llm.generate_text(prompt, max_tokens=2000, quality=True)
    except AnthropicNotConfigured:
        raise
    except Exception as e:
        logger.exception("suggest_signal_sources failed")
        raise RuntimeError(
            f"Generowanie propozycji nie powiodło się: {type(e).__name__}: {e}"
        ) from e

    raw = _parse_json_list_of_dicts(text)

    out: list[dict] = []
    for item in raw:
        ch = str(item.get("type", "")).strip()
        query = str(item.get("query", "")).strip()
        name = str(item.get("name", "")).strip()
        if ch not in _SUGGESTABLE_CHANNELS or not query or not name:
            continue
        try:
            weight = int(item.get("score_weight", 20))
        except (TypeError, ValueError):
            weight = 20
        out.append(
            {
                "type": ch,
                "name": name[:255],
                "query": query,
                "rationale": str(item.get("rationale", "")).strip(),
                "score_weight": max(0, min(1000, weight)),
                "max_results": 15,
            }
        )
    return out


def _parse_json_list_of_dicts(text: str) -> list[dict]:
    try:
        data = json.loads(_unwrap_json(text))
    except json.JSONDecodeError as e:
        logger.exception("suggest_signal_sources: niepoprawny JSON: %s", text[:300])
        raise RuntimeError("Claude zwrócił niepoprawny format propozycji") from e
    if not isinstance(data, list):
        raise RuntimeError("Claude zwrócił niepoprawny format propozycji")
    return [x for x in data if isinstance(x, dict)]


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
