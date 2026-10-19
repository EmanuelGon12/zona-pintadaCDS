from datetime import timedelta

from app.config import Settings
from app.database import SessionFactory
from app.models import LoginAttempt, ahora_utc

DATOS = {"email": "cliente@correo.com", "password": "contraseña123"}


def test_el_login_deja_la_sesion_en_una_cookie_httponly(api, headers_cliente):
    respuesta = api.post("/api/auth/login", json=DATOS)
    cookie = respuesta.headers["set-cookie"]
    assert cookie.startswith("zp_sesion=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Secure" not in cookie  # en local es http


def test_con_la_cookie_alcanza_para_estar_logueado(api, headers_cliente):
    api.cookies.clear()
    api.post("/api/auth/login", json=DATOS)
    assert api.get("/api/auth/me").json()["email"] == "cliente@correo.com"


def test_cerrar_sesion_borra_la_cookie(api, headers_cliente):
    api.cookies.clear()
    api.post("/api/auth/login", json=DATOS)
    respuesta = api.post("/api/auth/logout")
    assert respuesta.status_code == 204
    assert 'zp_sesion=""' in respuesta.headers["set-cookie"] or "Max-Age=0" in respuesta.headers["set-cookie"]
    assert api.get("/api/auth/me").status_code == 401


def test_en_produccion_la_cookie_es_secure(api, headers_cliente, monkeypatch):
    from app.routers import authentication

    monkeypatch.setattr(authentication, "obtener_config", lambda: Settings(public_base_url="https://tienda.com"))
    cookie = api.post("/api/auth/login", json=DATOS).headers["set-cookie"]
    assert "Secure" in cookie


def test_bloquea_el_login_despues_de_varios_intentos_fallidos(api, headers_cliente):
    for _ in range(5):
        assert api.post("/api/auth/login", json={**DATOS, "password": "incorrecta"}).status_code == 401

    bloqueado = api.post("/api/auth/login", json=DATOS)
    assert bloqueado.status_code == 429
    assert "Demasiados intentos" in bloqueado.json()["detail"]


def test_el_bloqueo_es_por_email(api, headers_cliente, headers_otro_cliente):
    for _ in range(5):
        api.post("/api/auth/login", json={**DATOS, "password": "incorrecta"})
    otro = api.post("/api/auth/login", json={"email": "otro@correo.com", "password": "contraseña123"})
    assert otro.status_code == 200


def test_un_login_correcto_reinicia_el_contador(api, headers_cliente):
    for _ in range(4):
        api.post("/api/auth/login", json={**DATOS, "password": "incorrecta"})
    assert api.post("/api/auth/login", json=DATOS).status_code == 200
    for _ in range(4):
        api.post("/api/auth/login", json={**DATOS, "password": "incorrecta"})
    assert api.post("/api/auth/login", json=DATOS).status_code == 200


def test_los_intentos_viejos_no_cuentan(api, headers_cliente):
    for _ in range(5):
        api.post("/api/auth/login", json={**DATOS, "password": "incorrecta"})
    with SessionFactory() as database:
        for intento in database.query(LoginAttempt):
            intento.created_at = ahora_utc() - timedelta(hours=1)
        database.commit()
    assert api.post("/api/auth/login", json=DATOS).status_code == 200


def test_endpoint_de_salud(api):
    assert api.get("/api/health").json() == {"estado": "ok"}
