import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import obtener_config
from app.database import obtener_sesion_db
from app.dependencies import usuario_actual
from app.models import Role, User
from app.schemas import LoginRequest, RegistrationRequest, SessionOut, UserOut
from app.security import crear_token, hashear_password, password_correcto
from app.services.intentos_login import esta_bloqueado, limpiar_intentos, registrar_fallo

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])
logger = logging.getLogger(__name__)


def abrir_sesion(response: Response, user: User) -> SessionOut:
    config = obtener_config()
    token = crear_token(user.id)
    # el navegador la manda solo y javascript no la puede leer (HttpOnly), asi un XSS no se roba la sesion.
    # SameSite=Lax evita que otro sitio haga POSTs con nuestra cookie (CSRF)
    response.set_cookie(
        config.session_cookie_name,
        token,
        max_age=config.jwt_expiration_minutes * 60,
        httponly=True,
        secure=config.public_base_url.startswith("https://"),
        samesite="lax",
        path="/",
    )
    # el token tambien va en el body para clientes que no son el navegador (postman, una app, los tests)
    return SessionOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def registrar(request: RegistrationRequest, response: Response, database: Session = Depends(obtener_sesion_db)):
    normalized_email = request.email.lower()
    already_registered = database.scalar(select(User).where(User.email == normalized_email))
    if already_registered:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese email.")

    user = User(
        email=normalized_email,
        full_name=request.full_name,
        password_hash=hashear_password(request.password),
        role=Role.CUSTOMER,
    )
    database.add(user)
    try:
        database.commit()
    except IntegrityError as error:
        # dos registros con el mismo email al mismo tiempo, el unique de la base lo frena
        database.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese email.") from error
    return abrir_sesion(response, user)


@router.post("/login", response_model=SessionOut)
def iniciar_sesion(request: LoginRequest, response: Response, database: Session = Depends(obtener_sesion_db)):
    email = request.email.lower()
    if esta_bloqueado(database, email):
        logger.warning("login bloqueado por demasiados intentos: %s", email)
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Espera unos minutos y vuelve a probar.")

    user = database.scalar(select(User).where(User.email == email))
    if user is None or not password_correcto(request.password, user.password_hash):
        registrar_fallo(database, email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos.")

    limpiar_intentos(database, email)
    return abrir_sesion(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def cerrar_sesion(response: Response):
    response.delete_cookie(obtener_config().session_cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def perfil_actual(user: User = Depends(usuario_actual)):
    return user
