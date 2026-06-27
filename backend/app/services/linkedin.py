"""LinkedIn outreach via the internal "Voyager" API.

This is the same mechanism HeyReach / lemlist / LaGrowthMachine use: LinkedIn
has no official outreach API, so we drive the member's own authenticated session
(the `li_at` cookie + JSESSIONID-as-CSRF) against `www.linkedin.com/voyager/api/*`,
optionally pinned to a dedicated proxy IP, with conservative daily caps.

⚠️ This automates actions against LinkedIn's ToS and can get an account
restricted. Use real human-like limits, a dedicated IP per account, and only
on accounts whose owner consented.

What's implemented here:
  - verify_session():  GET /voyager/api/me — proves the session is live and
    resolves the member identity (used by "Test połączenia").
  - resolve_profile(): turn a public profile URL (/in/<slug>) into the member
    URN needed for invites/messages.
  - send_invitation() / send_message(): the actual outreach calls.

Network egress to linkedin.com is required (won't work from a sandbox that
blocks it); on the deployment host it runs for real.
"""

import logging
from typing import Any

import httpx

from app.services.crypto import decrypt

logger = logging.getLogger(__name__)

_BASE = "https://www.linkedin.com"
_VOYAGER = f"{_BASE}/voyager/api"

# A realistic desktop UA reduces friction; Voyager also wants the restli header.
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


class LinkedInError(RuntimeError):
    """Any failure talking to Voyager (auth expired, rate-limited, blocked)."""


def _creds(account) -> tuple[str, str]:
    li_at = decrypt(account.li_at_enc)
    jsession = decrypt(account.jsessionid_enc)
    if not li_at or not jsession:
        raise LinkedInError("Brak/uszkodzona sesja — podłącz konto ponownie")
    return li_at, jsession


def _client(account) -> httpx.AsyncClient:
    li_at, jsession = _creds(account)
    # JSESSIONID is the CSRF token; LinkedIn stores it quoted in the cookie.
    csrf = jsession.strip('"')
    headers = {
        "user-agent": _UA,
        "accept": "application/vnd.linkedin.normalized+json+2.1",
        "csrf-token": csrf,
        "x-restli-protocol-version": "2.0.0",
        "x-li-lang": "en_US",
    }
    cookies = {"li_at": li_at, "JSESSIONID": f'"{csrf}"'}
    return httpx.AsyncClient(
        base_url=_VOYAGER,
        headers=headers,
        cookies=cookies,
        proxy=account.proxy_url or None,
        timeout=30,
        follow_redirects=False,
    )


async def verify_session(account) -> dict[str, Any]:
    """Confirm the session works and return the member identity. Raises
    LinkedInError on an expired/blocked session."""
    try:
        async with _client(account) as c:
            r = await c.get("/me")
    except LinkedInError:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("LinkedIn verify failed")
        raise LinkedInError(f"Połączenie nieudane: {type(e).__name__}: {e}") from e

    if r.status_code in (401, 403):
        raise LinkedInError(
            "Sesja wygasła lub zablokowana (401/403) — pobierz nowy cookie li_at"
        )
    if r.status_code != 200:
        raise LinkedInError(f"Voyager /me zwróciło {r.status_code}")

    data = r.json()
    mini = (data.get("included") or [{}])
    member_urn = data.get("data", {}).get("*miniProfile") or None
    name = None
    for inc in mini:
        if inc.get("$type", "").endswith("MiniProfile"):
            first = inc.get("firstName") or ""
            last = inc.get("lastName") or ""
            name = (f"{first} {last}").strip() or None
            member_urn = inc.get("entityUrn") or member_urn
            break
    return {"member_urn": member_urn, "name": name}


async def resolve_profile(account, profile_url: str) -> dict[str, Any]:
    """Resolve a public profile URL (https://www.linkedin.com/in/<slug>/) to the
    member's URN + name so we can invite/message them."""
    slug = profile_url.rstrip("/").split("/in/")[-1].split("/")[0].split("?")[0]
    if not slug:
        raise LinkedInError("Niepoprawny URL profilu LinkedIn")
    try:
        async with _client(account) as c:
            r = await c.get(
                f"/identity/profiles/{slug}/profileView"
            )
    except Exception as e:  # noqa: BLE001
        raise LinkedInError(f"Nie udało się pobrać profilu: {e}") from e
    if r.status_code != 200:
        raise LinkedInError(f"Profil {slug}: Voyager zwróciło {r.status_code}")
    data = r.json()
    profile = (data.get("profile") or {})
    urn = profile.get("entityUrn") or profile.get("miniProfile", {}).get(
        "entityUrn"
    )
    if not urn:
        raise LinkedInError("Nie znaleziono URN profilu")
    return {
        "member_urn": urn,
        "name": (
            f"{profile.get('firstName', '')} {profile.get('lastName', '')}"
        ).strip(),
    }


def _member_id(member_urn: str) -> str:
    # urn:li:fs_miniProfile:ACoAAB... or urn:li:fsd_profile:ACoAAB...
    return member_urn.rstrip("/").split(":")[-1]


async def send_invitation(
    account, member_urn: str, message: str | None = None
) -> None:
    """Send a connection request (optionally with a note)."""
    body: dict[str, Any] = {
        "invitee": {
            "com.linkedin.voyager.growth.invitation.InviteeProfile": {
                "profileId": _member_id(member_urn)
            }
        },
        "trackingId": "moation",
    }
    if message:
        body["message"] = message[:300]
    try:
        async with _client(account) as c:
            r = await c.post("/growth/normInvitations", json=body)
    except Exception as e:  # noqa: BLE001
        raise LinkedInError(f"Zaproszenie nieudane: {e}") from e
    if r.status_code not in (200, 201):
        raise LinkedInError(
            f"Zaproszenie odrzucone przez Voyager ({r.status_code})"
        )


async def send_message(account, member_urn: str, text: str) -> None:
    """Send a direct message to a (1st-degree) connection."""
    member = _member_id(member_urn)
    body = {
        "keyVersion": "LEGACY_INBOX",
        "conversationCreate": {
            "eventCreate": {
                "value": {
                    "com.linkedin.voyager.messaging.create.MessageCreate": {
                        "body": text,
                        "attachments": [],
                        "attributedBody": {"text": text, "attributes": []},
                    }
                }
            },
            "recipients": [member],
            "subtype": "MEMBER_TO_MEMBER",
        },
    }
    try:
        async with _client(account) as c:
            r = await c.post(
                "/messaging/conversations",
                params={"action": "create"},
                json=body,
            )
    except Exception as e:  # noqa: BLE001
        raise LinkedInError(f"Wiadomość nieudana: {e}") from e
    if r.status_code not in (200, 201):
        raise LinkedInError(
            f"Wiadomość odrzucona przez Voyager ({r.status_code})"
        )
