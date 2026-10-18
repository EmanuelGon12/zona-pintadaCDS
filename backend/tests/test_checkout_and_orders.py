from app.database import SessionFactory
from app.models import Product
from tests.conftest import crear_producto

APPROVED_CARD = "4242 4242 4242 4242"
DECLINED_CARD = "4000 0000 0000 0002"


def llenar_carrito(api, headers, product_id, quantity=2):
    api.post("/api/cart/items", headers=headers, json={"product_id": product_id, "size": "9", "quantity": quantity})


def iniciar_checkout(api, headers):
    return api.post("/api/checkout/session", headers=headers)


def test_checkout_con_carrito_vacio_falla(api, headers_cliente):
    assert iniciar_checkout(api, headers_cliente).status_code == 400


def test_checkout_guarda_el_precio_del_momento(api, headers_cliente):
    product_id = crear_producto(price_cents=5000)
    llenar_carrito(api, headers_cliente, product_id)
    order_id = iniciar_checkout(api, headers_cliente).json()["order_id"]

    with SessionFactory() as database:
        database.get(Product, product_id).price_cents = 9900
        database.commit()

    order = api.get(f"/api/orders/{order_id}", headers=headers_cliente).json()
    assert order["status"] == "PENDING"
    assert order["items"][0]["unit_price_cents"] == 5000
    assert order["subtotal_cents"] == 10000
    assert order["total_cents"] == 10900


def test_pago_aprobado_marca_pagada_descuenta_stock_y_vacia_carrito(api, headers_cliente):
    product_id = crear_producto(price_cents=8000, stock=5)
    llenar_carrito(api, headers_cliente, product_id, quantity=2)
    order_id = iniciar_checkout(api, headers_cliente).json()["order_id"]

    response = api.post(f"/api/checkout/simulated/{order_id}/pay", headers=headers_cliente, json={"card_number": APPROVED_CARD})
    assert response.status_code == 200
    assert response.json()["status"] == "PAID"
    assert response.json()["paid_at"] is not None

    assert api.get("/api/cart", headers=headers_cliente).json()["lines"] == []
    assert api.get(f"/api/products/{product_id}").json()["stock"] == 3


def test_tarjeta_rechazada_deja_todo_como_estaba(api, headers_cliente):
    product_id = crear_producto()
    llenar_carrito(api, headers_cliente, product_id)
    order_id = iniciar_checkout(api, headers_cliente).json()["order_id"]

    response = api.post(f"/api/checkout/simulated/{order_id}/pay", headers=headers_cliente, json={"card_number": DECLINED_CARD})
    assert response.status_code == 402
    assert api.get(f"/api/orders/{order_id}", headers=headers_cliente).json()["status"] == "PENDING"
    assert len(api.get("/api/cart", headers=headers_cliente).json()["lines"]) == 1


def test_no_se_puede_pagar_dos_veces(api, headers_cliente):
    product_id = crear_producto()
    llenar_carrito(api, headers_cliente, product_id)
    order_id = iniciar_checkout(api, headers_cliente).json()["order_id"]
    payment = {"card_number": APPROVED_CARD}
    api.post(f"/api/checkout/simulated/{order_id}/pay", headers=headers_cliente, json=payment)
    assert api.post(f"/api/checkout/simulated/{order_id}/pay", headers=headers_cliente, json=payment).status_code == 409


def test_abandonar_pago_cancela_la_orden(api, headers_cliente):
    product_id = crear_producto()
    llenar_carrito(api, headers_cliente, product_id)
    order_id = iniciar_checkout(api, headers_cliente).json()["order_id"]
    cancelled = api.post(f"/api/checkout/orders/{order_id}/cancel", headers=headers_cliente).json()
    assert cancelled["status"] == "CANCELLED"


def test_nuevo_checkout_cancela_el_pendiente_anterior(api, headers_cliente):
    product_id = crear_producto()
    llenar_carrito(api, headers_cliente, product_id)
    first_order_id = iniciar_checkout(api, headers_cliente).json()["order_id"]
    iniciar_checkout(api, headers_cliente)
    assert api.get(f"/api/orders/{first_order_id}", headers=headers_cliente).json()["status"] == "CANCELLED"


def test_checkout_rechaza_si_ya_no_hay_stock(api, headers_cliente):
    product_id = crear_producto(stock=3)
    llenar_carrito(api, headers_cliente, product_id, quantity=3)
    with SessionFactory() as database:
        database.get(Product, product_id).stock = 1
        database.commit()
    assert iniciar_checkout(api, headers_cliente).status_code == 409


def test_checkout_rechaza_producto_desactivado(api, headers_cliente):
    product_id = crear_producto()
    llenar_carrito(api, headers_cliente, product_id)
    with SessionFactory() as database:
        database.get(Product, product_id).is_active = False
        database.commit()
    assert iniciar_checkout(api, headers_cliente).status_code == 409


def test_cada_usuario_ve_solo_sus_ordenes(api, headers_cliente, headers_otro_cliente):
    product_id = crear_producto()
    llenar_carrito(api, headers_cliente, product_id)
    order_id = iniciar_checkout(api, headers_cliente).json()["order_id"]

    assert len(api.get("/api/orders", headers=headers_cliente).json()) == 1
    assert api.get("/api/orders", headers=headers_otro_cliente).json() == []
    assert api.get(f"/api/orders/{order_id}", headers=headers_otro_cliente).status_code == 404
    assert api.post(f"/api/checkout/orders/{order_id}/cancel", headers=headers_otro_cliente).status_code == 404
    assert api.post(
        f"/api/checkout/simulated/{order_id}/pay", headers=headers_otro_cliente, json={"card_number": APPROVED_CARD}
    ).status_code == 404


def test_webhook_sin_configurar_responde_400(api):
    assert api.post("/api/checkout/webhook", content=b"{}").status_code == 400
