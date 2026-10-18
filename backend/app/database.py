from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import obtener_config


class Base(DeclarativeBase):
    pass


def normalizar_url_base(database_url: str) -> str:
    # supabase te da la url como postgresql://, pero sqlalchemy necesita saber que driver usar
    for prefix in ("postgres://", "postgresql://"):
        if database_url.startswith(prefix):
            return "postgresql+psycopg://" + database_url[len(prefix):]
    return database_url


def crear_engine(database_url: str):
    database_url = normalizar_url_base(database_url)

    if database_url.startswith("sqlite"):
        database_file = database_url.split("sqlite:///", 1)[-1]
        if database_file and database_file != ":memory:":
            Path(database_file).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(database_url, connect_args={"check_same_thread": False})

        # sqlite por defecto no respeta las foreign keys, hay que prenderlas a mano
        @event.listens_for(engine, "connect")
        def activar_claves_foraneas(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine

    # en vercel cada request puede ser una funcion nueva, asi que sin pool propio.
    # El pooler de supabase ya se encarga, y prepare_threshold=None es porque pgbouncer no banca prepared statements
    return create_engine(database_url, poolclass=NullPool, connect_args={"prepare_threshold": None})


engine = crear_engine(obtener_config().database_url)
SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def obtener_sesion_db() -> Iterator[Session]:
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()
