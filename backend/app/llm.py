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
    prompt: str,
    *,
    max_tokens: int = 1000,
    quality: bool = False,
    json_mode: bool = False,
) -> str:
    """Run a plain generation (no web search) and return the text output.

    `quality=True` selects the stronger model where the provider distinguishes
    (Anthropic quality vs fast); Gemini uses a single configured model.
    `json_mode=True` asks the provider to return strict JSON (Gemini honours
    this via responseMimeType; Anthropic relies on the prompt + tolerant
    parsing on the caller side).
    """
    p = provider()
    if p == "gemini":
        return await _gemini(
            prompt, max_tokens=max_tokens, search=False, json_mode=json_mode
        )
    if p == "anthropic":
        return await _anthropic(prompt, max_tokens=max_tokens, search=False, quality=quality)
    raise LlmNotConfigured(_NOT_CONFIGURED_MSG)


# ---------- Gemini (REST via httpx) ----------


async def _gemini(
    prompt: str, *, max_tokens: int, search: bool, json_mode: bool = False
) -> str:
    gen_config: dict[str, Any] = {
        "maxOutputTokens": max_tokens,
        "temperature": 0.2,
    }
    body: dict[str, Any] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": gen_config,
    }
    if search:
        # Native Google Search grounding (Gemini 2.x) — the equivalent of
        # Anthropic's server-side web_search tool. (Cannot combine with the
        # JSON response mime type, so json_mode is ignored when searching.)
        body["tools"] = [{"google_search": {}}]
    else:
        # Gemini 2.5 (flash/pro) has "thinking" ON by default — internal
        # reasoning tokens are drawn from maxOutputTokens. For our structured
        # generations a small budget would be spent entirely on thoughts,
        # leaving NO visible output (finishReason=MAX_TOKENS, empty parts) and
        # breaking json.loads downstream. Disable thinking so the whole budget
        # goes to the actual answer.
        gen_config["thinkingConfig"] = {"thinkingBudget": 0}
        if json_mode:
            # Force strict JSON output — avoids markdown fences / prose
            # wrappers that break downstream json.loads.
            gen_config["responseMimeType"] = "application/json"

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
    # A safety block (recitation/safety) yields promptFeedback without
    # candidates — surface it instead of returning empty text.
    feedback = data.get("promptFeedback") or {}
    candidates = data.get("candidates") or []
    if not candidates:
        reason = feedback.get("blockReason") or "brak kandydatów"
        raise RuntimeError(f"Gemini nie zwrócił odpowiedzi ({reason})")

    cand = candidates[0]
    finish = cand.get("finishReason")
    parts = (cand.get("content") or {}).get("parts") or []
    text = "\n".join(
        p["text"] for p in parts if isinstance(p, dict) and p.get("text")
    ).strip()
    if not text:
        # Most common cause: MAX_TOKENS reached (budget too small / thinking).
        # Returning "" would surface as an opaque JSON-parse error upstream.
        logger.warning(
            "Gemini empty output (finishReason=%s, max_tokens=%s)",
            finish,
            max_tokens,
        )
        raise RuntimeError(
            "Gemini zwrócił pustą odpowiedź"
            + (
                " — przekroczono limit tokenów (zwiększ max_tokens)"
                if finish == "MAX_TOKENS"
                else f" (finishReason={finish})"
            )
        )
    return text


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
