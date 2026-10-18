import os
import tempfile
from pathlib import Path

TEST_DIRECTORY = Path(tempfile.mkdtemp(prefix="zona-pintada-tests-"))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DIRECTORY / 'test.db'}")
os.environ["MEDIA_DIRECTORY"] = str(TEST_DIRECTORY / "media")
os.environ["STRIPE_SECRET_KEY"] = ""
os.environ["JWT_SECRET"] = "clave-de-pruebas-con-longitud-suficiente-32"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionFactory, engine
from app.main import app
from app.models import Product, Role, User
from app.security import hashear_password

SNEAKER_SIZES = ["8", "9", "10"]
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture(autouse=True)
def limpiar_base():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def api():
    with TestClient(app) as test_client:
        yield test_client


def crear_producto(name="Alero 1", price_cents=10000, stock=5, is_active=True) -> int:
    with SessionFactory() as database:
        product = Product(
            name=name,
            colorway="Negro",
            description="Modelo de prueba",
            price_cents=price_cents,
            stock=stock,
            available_sizes=SNEAKER_SIZES,
            is_active=is_active,
        )
        database.add(product)
        database.commit()
        return product.id


def crear_usuario(email: str, role: Role = Role.CUSTOMER, password: str = "contraseña123") -> None:
    with SessionFactory() as database:
        database.add(User(email=email, full_name="Usuario de prueba", password_hash=hashear_password(password), role=role))
        database.commit()


def autorizacion_para(api: TestClient, email: str, password: str = "contraseña123") -> dict:
    response = api.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def headers_cliente(api):
    crear_usuario("cliente@correo.com")
    return autorizacion_para(api, "cliente@correo.com")


@pytest.fixture
def headers_otro_cliente(api):
    crear_usuario("otro@correo.com")
    return autorizacion_para(api, "otro@correo.com")


@pytest.fixture
def headers_admin(api):
    crear_usuario("admin@correo.com", role=Role.ADMIN)
    return autorizacion_para(api, "admin@correo.com")
