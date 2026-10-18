def test_registro_crea_cliente_y_devuelve_token(api):
    response = api.post(
        "/api/auth/register",
        json={"email": "Nuevo@Correo.com", "full_name": "Nuevo Cliente", "password": "clave-segura-1"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["role"] == "CUSTOMER"
    assert body["user"]["email"] == "nuevo@correo.com"
    assert body["access_token"]


def test_registro_rechaza_email_repetido(api):
    payload = {"email": "repetido@correo.com", "full_name": "Repetido", "password": "clave-segura-1"}
    assert api.post("/api/auth/register", json=payload).status_code == 201
    assert api.post("/api/auth/register", json=payload).status_code == 409


def test_registro_no_permite_elegir_rol_admin(api):
    response = api.post(
        "/api/auth/register",
        json={"email": "sneaky@correo.com", "full_name": "Sneaky", "password": "clave-segura-1", "role": "ADMIN"},
    )
    assert response.json()["user"]["role"] == "CUSTOMER"


def test_registro_rechaza_password_corta(api):
    response = api.post(
        "/api/auth/register", json={"email": "corta@correo.com", "full_name": "Corta", "password": "123"}
    )
    assert response.status_code == 422


def test_login_con_password_incorrecta(api, headers_cliente):
    response = api.post("/api/auth/login", json={"email": "cliente@correo.com", "password": "incorrecta"})
    assert response.status_code == 401


def test_carrito_requiere_login(api):
    assert api.get("/api/cart").status_code == 401


def test_cliente_no_entra_al_admin(api, headers_cliente):
    assert api.get("/api/admin/products", headers=headers_cliente).status_code == 403


def test_admin_entra_al_admin(api, headers_admin):
    assert api.get("/api/admin/products", headers=headers_admin).status_code == 200
