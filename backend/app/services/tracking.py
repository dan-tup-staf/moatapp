"""Open- and click-tracking helpers — a signed 1x1 pixel + signed link redirect.

Both the pixel URL and the click-redirect URL embed the message id + an HMAC
signature (keyed by jwt_secret) so the public endpoints can verify them without
a DB token column. Requires settings.tracking_base_url (the API's public URL).
"""

import hashlib
import hmac
from urllib.parse import quote

from app.config import settings

# 1x1 fully transparent GIF.
TRACK_GIF = bytes.fromhex(
    "47494638396101000100800000ffffff00000021f9040100000000"
    "2c00000000010001000002024c01003b"
)


def open_sig(message_id: int) -> str:
    return hmac.new(
        settings.jwt_secret.encode("utf-8"),
        str(message_id).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]


def open_pixel_url(message_id: int) -> str | None:
    base = (settings.tracking_base_url or "").rstrip("/")
    if not base:
        return None
    return f"{base}/api/v1/track/open/{message_id}-{open_sig(message_id)}.gif"


def click_sig(message_id: int) -> str:
    """Separate HMAC namespace from open_sig so a leaked open pixel can't be
    replayed as a click (and vice versa)."""
    return hmac.new(
        settings.jwt_secret.encode("utf-8"),
        f"click:{message_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]


def click_redirect_url(message_id: int, target_url: str) -> str | None:
    """Signed redirect that records a click then 302s to `target_url`.
    Returns None (caller keeps the raw link) when no tracking base is set."""
    base = (settings.tracking_base_url or "").rstrip("/")
    if not base:
        return None
    u = quote(target_url, safe="")
    return f"{base}/api/v1/track/click/{message_id}-{click_sig(message_id)}?u={u}"


def unsub_sig(lead_id: int) -> str:
    """Signature for a lead's one-click unsubscribe link."""
    return hmac.new(
        settings.jwt_secret.encode("utf-8"),
        f"unsub:{lead_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]


def unsubscribe_url(lead_id: int) -> str | None:
    """Public, signed unsubscribe link. None when no tracking base is set."""
    base = (settings.tracking_base_url or "").rstrip("/")
    if not base:
        return None
    return f"{base}/api/v1/track/unsubscribe/{lead_id}-{unsub_sig(lead_id)}"
