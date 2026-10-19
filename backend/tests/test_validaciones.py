import pytest

from tests.conftest import crear_producto

PRODUCTO = {"name": "Modelo", "price_cents": 100000, "stock": 1, "available_sizes": ["9"]}


@pytest.mark.parametrize(
    "datos, mensaje",
    [
        ({"email": "a@correo.com", "full_name": "   ", "password": "12345678"}, "Nombre: debe tener al menos 2 caracteres"),
        ({"email": "a@correo.com", "full_name": "Ana", "password": "123"}, "Contraseña: debe tener al menos 8 caracteres"),
        ({"email": "a@correo.com", "full_name": "Ana", "password": "ñ" * 40}, "Contraseña: es demasiado larga"),
        ({"email": "sin-arroba", "full_name": "Ana", "password": "12345678"}, "Email: no es una dirección válida."),
        ({"email": "a@correo.com", "password": "12345678"}, "Nombre: es obligatorio"),
    ],
)
def test_registro_valida_con_mensajes_en_espanol(api, datos, mensaje):
    respuesta = api.post("/api/auth/register", json=datos)
    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == mensaje


def test_el_nombre_se_guarda_sin_espacios_de_mas(api):
    respuesta = api.post("/api/auth/register", json={"email": "a@correo.com", "full_name": "  Ana Pérez  ", "password": "12345678"})
    assert respuesta.json()["user"]["full_name"] == "Ana Pérez"


def test_password_con_espacios_no_se_recorta(api):
    api.post("/api/auth/register", json={"email": "a@correo.com", "full_name": "Ana", "password": " con espacios "})
    assert api.post("/api/auth/login", json={"email": "a@correo.com", "password": " con espacios "}).status_code == 200
    assert api.post("/api/auth/login", json={"email": "a@correo.com", "password": "con espacios"}).status_code == 401


def test_el_login_no_distingue_mayusculas_en_el_email(api):
    api.post("/api/auth/register", json={"email": "Ana@Correo.com", "full_name": "Ana", "password": "12345678"})
    assert api.post("/api/auth/login", json={"email": "ANA@correo.COM", "password": "12345678"}).status_code == 200


def test_json_mal_formado(api):
    respuesta = api.post("/api/auth/login", content=b"{roto", headers={"Content-Type": "application/json"})
    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == "Los datos enviados no son un JSON válido."


def test_parametros_invalidos_del_catalogo(api):
    assert api.get("/api/products", params={"estilo": "DUNK"}).json()["detail"] == "Estilo de juego: no es una opción válida"
    assert api.get("/api/products", params={"limite": 0}).status_code == 422
    assert api.get("/api/products/abc").json()["detail"] == "Producto: debe ser un número entero"


@pytest.mark.parametrize(
    "cambios, campo",
    [
        ({"name": "   "}, "Nombre"),
        ({"price_cents": 0}, "Precio"),
        ({"stock": -1}, "Stock"),
        ({"available_sizes": []}, "Tallas"),
        ({"available_sizes": ["   "]}, "Tallas"),
        ({"play_style": "DUNK"}, "Estilo de juego"),
        ({"surface": "LUNA"}, "Superficie"),
    ],
)
def test_admin_valida_los_productos(api, headers_admin, cambios, campo):
    respuesta = api.post("/api/admin/products", headers=headers_admin, json={**PRODUCTO, **cambios})
    assert respuesta.status_code == 422
    assert respuesta.json()["detail"].startswith(f"{campo}:")


def test_cantidad_en_el_carrito_tiene_limites(api, headers_cliente):
    producto_id = crear_producto(stock=50)
    cero = api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 0})
    once = api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 11})
    assert cero.json()["detail"] == "Cantidad: debe ser mayor o igual a 1"
    assert once.json()["detail"] == "Puedes llevar hasta 10 unidades por talla."
