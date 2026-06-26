"""Provider-agnostic LLM helpers for the AI-powered features
(ICP generator + web_search-backed signal channels).

Two capabilities are needed across the app:
  - web_search_text(): a web-grounded generation (find recent items online)
  - generate_text():   a plain generation (no web search)

Provider selection — first configured wins:
  1. Google Gemini    (GEMINI_API_KEY)    — free tier, native Google Search
     grounding. Called over the REST API with httpx (already a dependency) so
     we don't pull in an extra SDK.
  2. Anthropic Claude (ANTHROPIC_API_KEY) — server-side web_search tool.

Gemini is preferred when both are set (it's the free one). If neither key is
configured, callers get LlmNotConfigured.
"""

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

_NOT_CONFIGURED_MSG = (
    "Brak klucza AI — ustaw GEMINI_API_KEY (darmowy, Google AI Studio) "
    "lub ANTHROPIC_API_KEY, aby korzystać z ICP i kanałów web_search."
)


class LlmNotConfigured(RuntimeError):
    """Raised when no AI provider key (Gemini or Anthropic) is configured."""


def provider() -> str | None:
    """Which provider to use. Gemini wins when both are set (it's the free one)."""
    if settings.gemini_api_key:
        return "gemini"
    if settings.anthropic_api_key:
        return "anthropic"
    return None


def is_configured() -> bool:
    return provider() is not None


async def web_search_text(prompt: str, *, max_tokens: int = 2500) -> str:
    """Run a web-grounded generation and return the model's text output."""
    p = provider()
    if p == "gemini":
        return await _gemini(prompt, max_tokens=max_tokens, search=True)
    if p == "anthropic":
        return await _anthropic(prompt, max_tokens=max_tokens, search=True, quality=False)
    raise LlmNotConfigured(_NOT_CONFIGURED_MSG)


async def generate_text(
    prompt: str, *, max_tokens: int = 1000, quality: bool = False
) -> str:
    """Run a plain generation (no web search) and return the text output.

    `quality=True` selects the stronger model where the provider distinguishes
    (Anthropic quality vs fast); Gemini uses a single configured model.
    """
    p = provider()
    if p == "gemini":
        return await _gemini(prompt, max_tokens=max_tokens, search=False)
    if p == "anthropic":
        return await _anthropic(prompt, max_tokens=max_tokens, search=False, quality=quality)
    raise LlmNotConfigured(_NOT_CONFIGURED_MSG)


# ---------- Gemini (REST via httpx) ----------


async def _gemini(prompt: str, *, max_tokens: int, search: bool) -> str:
    body: dict[str, Any] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.2},
    }
    if search:
        # Native Google Search grounding (Gemini 2.x) — the equivalent of
        # Anthropic's server-side web_search tool.
        body["tools"] = [{"google_search": {}}]

    url = _GEMINI_ENDPOINT.format(model=settings.gemini_model)
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                url, params={"key": settings.gemini_api_key}, json=body
            )
    except Exception as e:
        logger.exception("Gemini request failed")
        raise RuntimeError(f"Gemini niedostępny: {type(e).__name__}: {e}") from e

    if r.status_code != 200:
        logger.warning("Gemini API %s: %s", r.status_code, r.text[:300])
        raise RuntimeError(f"Gemini API zwrócił {r.status_code}: {r.text[:200]}")

    data = r.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "\n".join(
        p["text"] for p in parts if isinstance(p, dict) and p.get("text")
    ).strip()


# ---------- Anthropic ----------


async def _anthropic(
    prompt: str, *, max_tokens: int, search: bool, quality: bool
) -> str:
    from anthropic import AsyncAnthropic

    kwargs: dict[str, Any] = {"api_key": settings.anthropic_api_key}
    if settings.anthropic_base_url:
        kwargs["base_url"] = settings.anthropic_base_url
    client = AsyncAnthropic(**kwargs)

    create_kwargs: dict[str, Any] = {
        "model": (
            settings.anthropic_model_quality
            if quality
            else settings.anthropic_model_fast
        ),
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if search:
        create_kwargs["tools"] = [
            {"type": "web_search_20260209", "name": "web_search"}
        ]

    try:
        resp = await client.messages.create(**create_kwargs)
    except Exception as e:
        logger.exception("Anthropic request failed")
        raise RuntimeError(f"Claude niedostępny: {type(e).__name__}: {e}") from e

    return "\n".join(
        b.text.strip() for b in resp.content if b.type == "text" and b.text.strip()
    ).strip()
