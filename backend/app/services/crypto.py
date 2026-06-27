"""Symmetric encryption for secrets stored at rest (e.g. SMTP passwords,
LinkedIn session cookies).

Key is derived from settings.jwt_secret so we don't need a separate secret to
manage. Uses Fernet (AES-128-CBC + HMAC) from `cryptography`, which is already
an indirect dependency. Ciphertext is a URL-safe base64 string.
"""

import base64
import hashlib

from app.config import settings


def _fernet():
    from cryptography.fernet import Fernet

    raw = hashlib.sha256(
        (settings.jwt_secret or "moation").encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt(plaintext: str) -> str:
    """Encrypt a secret. Empty/None-ish input returns "" (nothing to store)."""
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(token: str | None) -> str | None:
    """Decrypt a stored secret. Returns None on empty input or any failure
    (wrong key / corrupted) so callers can fall back gracefully."""
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except Exception:
        return None
