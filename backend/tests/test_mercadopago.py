import hashlib
import hmac
import json

import httpx

from app.config import Settings
from app.models import Order, OrderItem, OrderStatus
from app.services.payments import MercadoPagoGateway, firma_mercadopago_valida


def armar_orden():
    orden = Order(id=42, user_id=1, status=OrderStatus.PENDING, subtotal_cents=519000, shipping_cents=29000, total_cents=548000)
    orden.items = [OrderItem(product_id=2, product_name="Zapatilla blanca", size="9", quantity=1, unit_price_cents=519000)]
    return orden


def pasarela_con(respuesta, pedidos, base_url="http://localhost:8010"):
    def manejar(pedido):
        pedidos.append(pedido)
        return httpx.Response(200, json=respuesta)

    http = httpx.Client(base_url=MercadoPagoGateway.API, transport=httpx.MockTransport(manejar))
    config = Settings(mercadopago_access_token="TEST-token", public_base_url=base_url)
    return MercadoPagoGateway(config, http=http)


def test_crea_la_preferencia_en_pesos_con_envio():
    pedidos = []
    pasarela = pasarela_con({"id": "pref-1", "init_point": "https://www.mercadopago.com.uy/checkout?pref_id=pref-1"}, pedidos)

    sesion = pasarela.abrir_sesion(armar_orden(), "http://localhost:8010/pedidos/42?pago=exitoso", "http://localhost:8010/carrito")

    assert sesion.checkout_url.startswith("https://www.mercadopago.com.uy")
    enviado = json.loads(pedidos[0].content)
    assert pedidos[0].headers["Authorization"] == "Bearer TEST-token"
    assert enviado["external_reference"] == "42"
    assert [(item["unit_price"], item["currency_id"]) for item in enviado["items"]] == [(5190, "UYU"), (290, "UYU")]
    # en local no se manda auto_return porque mercado pago lo rechaza
    assert "auto_return" not in enviado and "notification_url" not in enviado


def test_con_url_publica_activa_vuelta_automatica_y_notificaciones():
    pedidos = []
    pasarela = pasarela_con({"id": "pref-1", "init_point": "https://mp"}, pedidos, base_url="https://zona.vercel.app")
    pasarela.abrir_sesion(armar_orden(), "https://zona.vercel.app/pedidos/42?pago=exitoso", "https://zona.vercel.app/carrito")
    enviado = json.loads(pedidos[0].content)
    assert enviado["auto_return"] == "approved"
    assert enviado["notification_url"] == "https://zona.vercel.app/api/checkout/webhook/mercadopago"


def test_detecta_pago_aprobado_por_referencia():
    pedidos = []
    pasarela = pasarela_con({"results": [{"id": 1, "status": "approved"}]}, pedidos)
    assert pasarela.esta_pagada(armar_orden()) is True
    assert pedidos[0].url.params["external_reference"] == "42"

    assert pasarela_con({"results": []}, []).esta_pagada(armar_orden()) is False


def test_valida_la_firma_del_webhook():
    secreto = "secreto-de-prueba"
    manifiesto = "id:123;request-id:abc;ts:1700000000;"
    firma = hmac.new(secreto.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()

    assert firma_mercadopago_valida(secreto, f"ts=1700000000,v1={firma}", "abc", "123")
    assert not firma_mercadopago_valida(secreto, f"ts=1700000000,v1={firma}", "otro", "123")
    assert not firma_mercadopago_valida(secreto, None, "abc", "123")


def test_webhook_marca_pagada_la_orden_aprobada(api, headers_cliente, monkeypatch):
    from app.routers import checkout
    from tests.conftest import crear_producto

    producto_id = crear_producto(price_cents=519000)
    api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 1})
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]

    class PasarelaFalsa(MercadoPagoGateway):
        def __init__(self):
            pass

        def consultar_pago(self, pago_id):
            return {"id": pago_id, "status": "approved", "external_reference": str(orden_id)}

    monkeypatch.setattr(checkout, "obtener_pasarela", lambda: PasarelaFalsa())
    respuesta = api.post("/api/checkout/webhook/mercadopago?data.id=999&type=payment", json={"type": "payment", "data": {"id": "999"}})

    assert respuesta.status_code == 200
    assert api.get(f"/api/orders/{orden_id}", headers=headers_cliente).json()["status"] == "PAID"


def test_webhook_ignora_avisos_que_no_son_pagos(api):
    assert api.post("/api/checkout/webhook/mercadopago?topic=merchant_order&id=5", json={}).status_code == 200
