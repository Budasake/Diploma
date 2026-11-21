"""
Passwords and login tokens.

Passwords: hashed with Argon2 (a slow, salted hash built for passwords).
The database stores only the hash, so even a leaked database doesn't reveal
passwords.

Tokens: after login the user gets a JWT — a signed note saying "this is user 7,
role student, valid until <time>". The signature (made with SECRET_KEY) means
the browser can't change it without the server noticing.
"""

from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_hasher = PasswordHasher()
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: int, role: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.secret_key.get_secret_value(), algorithm=_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Return the user id inside a valid token, or None if it's invalid or expired."""
    try:
        payload = jwt.decode(
            token, get_settings().secret_key.get_secret_value(), algorithms=[_ALGORITHM]
        )
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
