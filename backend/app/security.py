from datetime import timedelta
from typing import Optional

import bcrypt
import jwt

from app.config import get_settings
from app.models import current_utc_time

TOKEN_ALGORITHM = "HS256"


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def password_matches(plain_password: str, stored_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    expires_at = current_utc_time() + timedelta(minutes=settings.jwt_expiration_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expires_at}, settings.jwt_secret, algorithm=TOKEN_ALGORITHM)


def read_user_id_from_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[TOKEN_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
