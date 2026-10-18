from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def normalize_database_url(database_url: str) -> str:
    for prefix in ("postgres://", "postgresql://"):
        if database_url.startswith(prefix):
            return "postgresql+psycopg://" + database_url[len(prefix):]
    return database_url


def build_engine(database_url: str):
    database_url = normalize_database_url(database_url)

    if database_url.startswith("sqlite"):
        database_file = database_url.split("sqlite:///", 1)[-1]
        if database_file and database_file != ":memory:":
            Path(database_file).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(database_url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine

    return create_engine(database_url, poolclass=NullPool, connect_args={"prepare_threshold": None})


engine = build_engine(get_settings().database_url)
SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_database_session() -> Iterator[Session]:
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()
