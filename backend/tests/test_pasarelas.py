import hashlib
import hmac

from app import config as modulo_config
from app.config import Settings
from app.database import SessionFactory
from app.main import app
from app.models import Product
from app.services.payments import (
    MercadoPagoGateway,
    PaymentProviderError,
    SimulatedGateway,
    StripeGateway,
    obtener_pasarela,
)
from tests.conftest import crear_producto


def test_se_elige_la_pasarela_segun_la_configuracion(monkeypatch):
    casos = [
        (Settings(mercadopago_access_token="APP_USR-x", stripe_secret_key="sk_test"), MercadoPagoGateway),
        (Settings(mercadopago_access_token=None, stripe_secret_key="sk_test"), StripeGateway),
        (Settings(mercadopago_access_token=None, stripe_secret_key=None), SimulatedGateway),
    ]
    from app.services import payments

    for config, esperada in casos:
        monkeypatch.setattr(payments, "obtener_config", lambda config=config: config)
        assert isinstance(obtener_pasarela(), esperada)


class PasarelaQueFalla:
    def abrir_sesion(self, order, success_url, cancel_url):
        raise PaymentProviderError("sin conexión")

    def esta_pagada(self, order):
        raise PaymentProviderError("sin conexión")


class PasarelaQueAprueba:
    def abrir_sesion(self, order, success_url, cancel_url):
        from app.services.payments import PaymentSession

        return PaymentSession(session_id="pref-1", checkout_url="https://pagos.test/pref-1")

    def esta_pagada(self, order):
        return True


def test_si_la_pasarela_falla_se_cancela_la_orden_y_vuelve_el_stock(api, headers_cliente):
    producto_id = crear_producto(stock=3)
    api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 1})
    app.dependency_overrides[obtener_pasarela] = lambda: PasarelaQueFalla()
    try:
        respuesta = api.post("/api/checkout/session", headers=headers_cliente)
    finally:
        app.dependency_overrides.clear()

    assert respuesta.status_code == 502
    pedidos = api.get("/api/orders", headers=headers_cliente).json()
    assert pedidos[0]["status"] == "CANCELLED"
    with SessionFactory() as database:
        assert database.get(Product, producto_id).stock == 3


def test_confirmar_pago_con_pasarela_externa(api, headers_cliente):
    producto_id = crear_producto(stock=3)
    api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 1})
    app.dependency_overrides[obtener_pasarela] = lambda: PasarelaQueAprueba()
    try:
        inicio = api.post("/api/checkout/session", headers=headers_cliente).json()
        confirmada = api.post(f"/api/checkout/orders/{inicio['order_id']}/confirm", headers=headers_cliente).json()
    finally:
        app.dependency_overrides.clear()

    assert inicio["checkout_url"] == "https://pagos.test/pref-1"
    assert confirmada["status"] == "PAID"
    assert api.get("/api/cart", headers=headers_cliente).json()["lines"] == []


def test_confirmar_cuando_la_pasarela_no_responde(api, headers_cliente):
    producto_id = crear_producto(stock=3)
    api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 1})
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]
    app.dependency_overrides[obtener_pasarela] = lambda: PasarelaQueFalla()
    try:
        respuesta = api.post(f"/api/checkout/orders/{orden_id}/confirm", headers=headers_cliente)
    finally:
        app.dependency_overrides.clear()
    assert respuesta.status_code == 502


def test_el_simulador_no_existe_si_hay_pasarela_real(api, headers_cliente, monkeypatch):
    from app.routers import checkout

    monkeypatch.setattr(checkout, "obtener_config", lambda: Settings(mercadopago_access_token="APP_USR-x"))
    respuesta = api.post("/api/checkout/simulated/1/pay", headers=headers_cliente, json={"card_number": "4242424242424242"})
    assert respuesta.status_code == 404


def preparar_orden_pendiente(api, headers):
    producto_id = crear_producto(stock=3)
    api.post("/api/cart/items", headers=headers, json={"product_id": producto_id, "size": "9", "quantity": 1})
    return api.post("/api/checkout/session", headers=headers).json()["order_id"]


def pasarela_mp_falsa(estado, orden_id):
    class PasarelaFalsa(MercadoPagoGateway):
        def __init__(self):
            pass

        def consultar_pago(self, pago_id):
            return {"id": pago_id, "status": estado, "external_reference": str(orden_id)}

    return PasarelaFalsa()


def test_webhook_mp_no_marca_pagos_rechazados(api, headers_cliente, monkeypatch):
    from app.routers import checkout

    orden_id = preparar_orden_pendiente(api, headers_cliente)
    monkeypatch.setattr(checkout, "obtener_pasarela", lambda: pasarela_mp_falsa("rejected", orden_id))
    api.post("/api/checkout/webhook/mercadopago?data.id=1&type=payment")
    assert api.get(f"/api/orders/{orden_id}", headers=headers_cliente).json()["status"] == "PENDING"


def test_webhook_mp_rechaza_firmas_invalidas(api, headers_cliente, monkeypatch):
    from app.routers import checkout

    orden_id = preparar_orden_pendiente(api, headers_cliente)
    monkeypatch.setattr(checkout, "obtener_config", lambda: Settings(mercadopago_access_token="APP_USR-x", mercadopago_webhook_secret="secreto"))
    monkeypatch.setattr(checkout, "obtener_pasarela", lambda: pasarela_mp_falsa("approved", orden_id))

    sin_firma = api.post("/api/checkout/webhook/mercadopago?data.id=77&type=payment")
    assert sin_firma.status_code == 400

    firma = hmac.new(b"secreto", b"id:77;request-id:req-1;ts:1700000000;", hashlib.sha256).hexdigest()
    con_firma = api.post(
        "/api/checkout/webhook/mercadopago?data.id=77&type=payment",
        headers={"x-signature": f"ts=1700000000,v1={firma}", "x-request-id": "req-1"},
    )
    assert con_firma.status_code == 200
    assert api.get(f"/api/orders/{orden_id}", headers=headers_cliente).json()["status"] == "PAID"


def test_webhook_mp_ignora_ordenes_que_no_existen(api, monkeypatch):
    from app.routers import checkout

    monkeypatch.setattr(checkout, "obtener_pasarela", lambda: pasarela_mp_falsa("approved", 9999))
    assert api.post("/api/checkout/webhook/mercadopago?data.id=1&type=payment").status_code == 200


def test_webhook_stripe_con_firma_invalida(api, monkeypatch):
    from app.services import payments

    monkeypatch.setattr(payments, "obtener_config", lambda: Settings(stripe_webhook_secret="whsec_prueba"))
    respuesta = api.post("/api/checkout/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=firma-falsa"})
    assert respuesta.status_code == 400
