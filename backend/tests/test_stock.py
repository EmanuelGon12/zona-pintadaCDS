from datetime import timedelta

import pytest

from app.database import SessionFactory
from app.models import Order, OrderStatus, Product, User, ahora_utc
from app.services.orders import StockAgotado, crear_orden_pendiente, items_del_carrito, liberar_reservas_vencidas, marcar_orden_pagada
from tests.conftest import crear_producto

TARJETA_OK = {"card_number": "4242 4242 4242 4242"}


def al_carrito(api, headers, producto_id, cantidad=1):
    return api.post("/api/cart/items", headers=headers, json={"product_id": producto_id, "size": "9", "quantity": cantidad})


def stock_de(producto_id):
    with SessionFactory() as database:
        return database.get(Product, producto_id).stock


def test_iniciar_el_pago_reserva_el_stock(api, headers_cliente):
    producto_id = crear_producto(stock=5)
    al_carrito(api, headers_cliente, producto_id, 2)
    api.post("/api/checkout/session", headers=headers_cliente)
    assert stock_de(producto_id) == 3


def test_no_se_puede_vender_dos_veces_la_ultima_unidad(api, headers_cliente, headers_otro_cliente):
    producto_id = crear_producto(stock=1)
    al_carrito(api, headers_cliente, producto_id)
    al_carrito(api, headers_otro_cliente, producto_id)

    assert api.post("/api/checkout/session", headers=headers_cliente).status_code == 201
    respuesta = api.post("/api/checkout/session", headers=headers_otro_cliente)

    assert respuesta.status_code == 409
    assert "Sin stock" in respuesta.json()["detail"]


def test_la_reserva_propia_no_bloquea_el_carrito(api, headers_cliente):
    producto_id = crear_producto(stock=1)
    al_carrito(api, headers_cliente, producto_id)
    api.post("/api/checkout/session", headers=headers_cliente)

    carrito = api.get("/api/cart", headers=headers_cliente).json()
    assert carrito["can_checkout"] is True
    # y puede volver a intentar el pago sin quedar trabado por su propia reserva
    assert api.post("/api/checkout/session", headers=headers_cliente).status_code == 201
    assert stock_de(producto_id) == 0


def test_cancelar_el_pago_devuelve_el_stock(api, headers_cliente):
    producto_id = crear_producto(stock=3)
    al_carrito(api, headers_cliente, producto_id, 2)
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]

    api.post(f"/api/checkout/orders/{orden_id}/cancel", headers=headers_cliente)
    assert stock_de(producto_id) == 3


def test_cancelar_una_orden_pagada_no_hace_nada(api, headers_cliente):
    producto_id = crear_producto(stock=3)
    al_carrito(api, headers_cliente, producto_id)
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]
    api.post(f"/api/checkout/simulated/{orden_id}/pay", headers=headers_cliente, json=TARJETA_OK)

    respuesta = api.post(f"/api/checkout/orders/{orden_id}/cancel", headers=headers_cliente)
    assert respuesta.json()["status"] == "PAID"
    assert stock_de(producto_id) == 2


def test_las_reservas_vencidas_se_liberan(api, headers_cliente):
    producto_id = crear_producto(stock=2)
    al_carrito(api, headers_cliente, producto_id, 2)
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]

    with SessionFactory() as database:
        database.get(Order, orden_id).created_at = ahora_utc() - timedelta(hours=2)
        database.commit()
        assert liberar_reservas_vencidas(database) == 1

    assert stock_de(producto_id) == 2
    assert api.get(f"/api/orders/{orden_id}", headers=headers_cliente).json()["status"] == "CANCELLED"


def test_no_se_puede_pagar_una_reserva_vencida(api, headers_cliente):
    producto_id = crear_producto(stock=2)
    al_carrito(api, headers_cliente, producto_id)
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]
    with SessionFactory() as database:
        database.get(Order, orden_id).created_at = ahora_utc() - timedelta(hours=2)
        database.commit()

    respuesta = api.post(f"/api/checkout/simulated/{orden_id}/pay", headers=headers_cliente, json=TARJETA_OK)
    assert respuesta.status_code == 409


def test_pago_que_llega_tarde_vuelve_a_descontar_el_stock(api, headers_cliente):
    producto_id = crear_producto(stock=4)
    al_carrito(api, headers_cliente, producto_id, 2)
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]
    api.post(f"/api/checkout/orders/{orden_id}/cancel", headers=headers_cliente)
    assert stock_de(producto_id) == 4

    with SessionFactory() as database:
        orden = database.get(Order, orden_id)
        marcar_orden_pagada(database, orden)
        assert orden.status == OrderStatus.PAID

    assert stock_de(producto_id) == 2


def test_si_otro_compra_en_el_medio_avisa_que_se_agoto(api, headers_cliente):
    producto_id = crear_producto(stock=1)
    al_carrito(api, headers_cliente, producto_id)

    with SessionFactory() as database:
        usuario = database.query(User).filter_by(email="cliente@correo.com").one()
        items = items_del_carrito(database, usuario)
        # alguien se lleva la unidad despues de validar pero antes de reservar
        database.query(Product).filter_by(id=producto_id).update({"stock": 0})
        with pytest.raises(StockAgotado):
            crear_orden_pendiente(database, usuario, items)
