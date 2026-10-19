from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import Settings, obtener_config
from app.database import SessionFactory
from app.models import User
from app.storage import LocalDiskStorage

RUTAS_PRIVADAS = [
    ("get", "/api/auth/me"),
    ("get", "/api/cart"),
    ("post", "/api/cart/items"),
    ("get", "/api/orders"),
    ("get", "/api/orders/1"),
    ("post", "/api/checkout/session"),
    ("post", "/api/checkout/orders/1/confirm"),
    ("get", "/api/admin/products"),
]

RUTAS_ADMIN = [
    ("get", "/api/admin/products"),
    ("get", "/api/admin/products/1"),
    ("post", "/api/admin/products"),
    ("put", "/api/admin/products/1"),
    ("put", "/api/admin/products/1/image"),
]


@pytest.mark.parametrize("metodo, ruta", RUTAS_PRIVADAS)
def test_rutas_privadas_piden_login(api, metodo, ruta):
    assert getattr(api, metodo)(ruta).status_code == 401


@pytest.mark.parametrize("metodo, ruta", RUTAS_ADMIN)
def test_un_cliente_no_entra_a_ninguna_ruta_del_admin(api, headers_cliente, metodo, ruta):
    assert getattr(api, metodo)(ruta, headers=headers_cliente).status_code == 403


def token_con(**cambios):
    datos = {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(minutes=5), **cambios}
    clave = cambios.pop("clave", obtener_config().jwt_secret)
    datos.pop("clave", None)
    return {"Authorization": "Bearer " + jwt.encode(datos, clave, algorithm="HS256")}


def test_token_vencido(api, headers_cliente):
    vencido = token_con(exp=datetime.now(timezone.utc) - timedelta(minutes=1))
    assert api.get("/api/auth/me", headers=vencido).status_code == 401


def test_token_firmado_con_otra_clave(api, headers_cliente):
    assert api.get("/api/auth/me", headers=token_con(clave="otra-clave-cualquiera-de-32-bytes!!")).status_code == 401


def test_token_de_un_usuario_que_ya_no_existe(api, headers_cliente):
    with SessionFactory() as database:
        database.query(User).delete()
        database.commit()
    assert api.get("/api/auth/me", headers=headers_cliente).status_code == 401


def test_login_no_revela_si_el_email_existe(api, headers_cliente):
    no_existe = api.post("/api/auth/login", json={"email": "nadie@correo.com", "password": "12345678"})
    mala_clave = api.post("/api/auth/login", json={"email": "cliente@correo.com", "password": "incorrecta"})
    assert no_existe.status_code == mala_clave.status_code == 401
    assert no_existe.json() == mala_clave.json()


def test_la_respuesta_no_expone_el_hash_de_la_password(api, headers_cliente):
    usuario = api.get("/api/auth/me", headers=headers_cliente).json()
    assert "password_hash" not in usuario and "password" not in usuario


def test_cabeceras_de_seguridad(api):
    respuesta = api.get("/api/products")
    assert respuesta.headers["X-Content-Type-Options"] == "nosniff"
    assert respuesta.headers["X-Frame-Options"] == "DENY"


def test_no_arranca_en_produccion_con_la_clave_de_ejemplo(monkeypatch):
    from app import main

    config = Settings(public_base_url="https://tienda.com", jwt_secret=main.CLAVE_JWT_POR_DEFECTO)
    monkeypatch.setattr(main, "obtener_config", lambda: config)
    with pytest.raises(RuntimeError):
        main.crear_aplicacion()


def test_el_storage_local_no_escribe_fuera_de_su_carpeta(tmp_path):
    storage = LocalDiskStorage(tmp_path / "media")
    with pytest.raises(ValueError):
        storage.guardar("../afuera.txt", b"x", "text/plain")


def test_busqueda_no_rompe_con_caracteres_raros(api):
    for termino in ["'; DROP TABLE products; --", "%", "_", "\\", "ñandú"]:
        assert api.get("/api/products", params={"q": termino}).status_code == 200


def test_rutas_de_api_inexistentes_dan_404_con_cualquier_metodo(api, tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.main import SinglePageApplication

    (tmp_path / "index.html").write_text("<html>tienda</html>")
    app_con_frontend = FastAPI()
    app_con_frontend.mount("/", SinglePageApplication(directory=tmp_path, html=True))
    cliente = TestClient(app_con_frontend)

    assert cliente.post("/api/checkout/webhook").status_code == 404
    assert cliente.get("/api/no-existe").status_code == 404
    # y las rutas del frontend siguen devolviendo la app
    assert cliente.get("/modelos").text == "<html>tienda</html>"
