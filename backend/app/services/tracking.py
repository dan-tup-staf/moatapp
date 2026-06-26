"""Open-tracking helpers — a signed 1x1 pixel.

The pixel URL embeds the message id + an HMAC signature (keyed by jwt_secret)
so the public endpoint can verify it without a DB token column. Requires
settings.tracking_base_url (the API's public URL) to be set.
"""

import hashlib
import hmac

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
