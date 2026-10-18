from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_database_session
from app.dependencies import get_current_user
from app.models import Role, User
from app.schemas import LoginRequest, RegistrationRequest, SessionOut, UserOut
from app.security import create_access_token, hash_password, password_matches

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def register(request: RegistrationRequest, database: Session = Depends(get_database_session)):
    normalized_email = request.email.lower()
    already_registered = database.scalar(select(User).where(User.email == normalized_email))
    if already_registered:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese email.")

    user = User(
        email=normalized_email,
        full_name=request.full_name,
        password_hash=hash_password(request.password),
        role=Role.CUSTOMER,
    )
    database.add(user)
    try:
        database.commit()
    except IntegrityError:
        database.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese email.")
    return SessionOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=SessionOut)
def login(request: LoginRequest, database: Session = Depends(get_database_session)):
    user = database.scalar(select(User).where(User.email == request.email.lower()))
    if user is None or not password_matches(request.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos.")
    return SessionOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def current_user_profile(user: User = Depends(get_current_user)):
    return user
