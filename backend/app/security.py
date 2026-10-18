from datetime import timedelta
from typing import Optional

import bcrypt
import jwt

from app.config import obtener_config
from app.models import ahora_utc

TOKEN_ALGORITHM = "HS256"


def hashear_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def password_correcto(plain_password: str, stored_hash: str) -> bool:
    try:  # si el hash guardado esta roto bcrypt tira ValueError
        return bcrypt.checkpw(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))
    except ValueError:
        return False


def crear_token(user_id: int) -> str:
    settings = obtener_config()
    expires_at = ahora_utc() + timedelta(minutes=settings.jwt_expiration_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expires_at}, settings.jwt_secret, algorithm=TOKEN_ALGORITHM)


def leer_usuario_del_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, obtener_config().jwt_secret, algorithms=[TOKEN_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
