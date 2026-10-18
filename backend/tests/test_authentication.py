def test_registration_creates_customer_and_returns_token(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "Nuevo@Correo.com", "full_name": "Nuevo Cliente", "password": "clave-segura-1"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["role"] == "CUSTOMER"
    assert body["user"]["email"] == "nuevo@correo.com"
    assert body["access_token"]


def test_registration_rejects_duplicate_email(client):
    payload = {"email": "repetido@correo.com", "full_name": "Repetido", "password": "clave-segura-1"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/register", json=payload).status_code == 409


def test_registration_cannot_choose_admin_role(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "sneaky@correo.com", "full_name": "Sneaky", "password": "clave-segura-1", "role": "ADMIN"},
    )
    assert response.json()["user"]["role"] == "CUSTOMER"


def test_registration_rejects_short_password(client):
    response = client.post(
        "/api/auth/register", json={"email": "corta@correo.com", "full_name": "Corta", "password": "123"}
    )
    assert response.status_code == 422


def test_login_with_wrong_password_is_rejected(client, customer_headers):
    response = client.post("/api/auth/login", json={"email": "cliente@correo.com", "password": "incorrecta"})
    assert response.status_code == 401


def test_cart_requires_authentication(client):
    assert client.get("/api/cart").status_code == 401


def test_customer_cannot_reach_admin_endpoints(client, customer_headers):
    assert client.get("/api/admin/products", headers=customer_headers).status_code == 403


def test_admin_can_reach_admin_endpoints(client, admin_headers):
    assert client.get("/api/admin/products", headers=admin_headers).status_code == 200
