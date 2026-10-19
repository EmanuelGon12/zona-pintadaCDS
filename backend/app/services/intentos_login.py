from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import obtener_config
from app.models import LoginAttempt, ahora_utc


def _inicio_de_la_ventana():
    return ahora_utc() - timedelta(minutes=obtener_config().login_window_minutes)


def esta_bloqueado(database: Session, email: str) -> bool:
    fallidos = database.scalar(
        select(func.count(LoginAttempt.id)).where(LoginAttempt.email == email, LoginAttempt.created_at >= _inicio_de_la_ventana())
    )
    return fallidos >= obtener_config().login_max_attempts


def registrar_fallo(database: Session, email: str) -> None:
    # de paso borro los viejos para que la tabla no crezca para siempre
    database.execute(delete(LoginAttempt).where(LoginAttempt.created_at < _inicio_de_la_ventana()))
    database.add(LoginAttempt(email=email))
    database.commit()


def limpiar_intentos(database: Session, email: str) -> None:
    database.execute(delete(LoginAttempt).where(LoginAttempt.email == email))
    database.commit()
