from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import obtener_config
from app.database import obtener_sesion_db
from app.models import Role, User
from app.security import leer_usuario_del_token

bearer_scheme = HTTPBearer(auto_error=False)


# se usa como Depends en todo lo que necesita login.
# El navegador manda la cookie; otros clientes pueden mandar el header Authorization: Bearer
def usuario_actual(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    database: Session = Depends(obtener_sesion_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Tienes que iniciar sesión para continuar.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials if credentials else request.cookies.get(obtener_config().session_cookie_name)
    if not token:
        raise unauthorized
    user_id = leer_usuario_del_token(token)
    if user_id is None:
        raise unauthorized
    user = database.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


def requerir_admin(user: User = Depends(usuario_actual)) -> User:
    if user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para esta sección.")
    return user
