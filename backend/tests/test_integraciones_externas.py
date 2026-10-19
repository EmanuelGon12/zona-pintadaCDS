import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest
import stripe

from app.config import Settings
from app.database import SessionFactory
from app.models import Order, OrderItem, OrderStatus, Product, User
from app.services.payments import PaymentProviderError, StripeGateway
from app.storage import S3Storage
from tests.conftest import crear_producto


def orden_de_prueba():
    orden = Order(id=7, user_id=1, status=OrderStatus.PENDING, subtotal_cents=519000, shipping_cents=29000, total_cents=548000)
    orden.items = [OrderItem(product_id=2, product_name="Zapatilla", size="9", quantity=2, unit_price_cents=259500)]
    orden.payment_session_id = "cs_test_1"
    return orden


def test_stripe_arma_la_sesion_con_productos_envio_y_vencimiento(monkeypatch):
    enviado = {}

    def crear(**datos):
        enviado.update(datos)
        return SimpleNamespace(id="cs_test_1", url="https://checkout.stripe.com/cs_test_1")

    monkeypatch.setattr(stripe.checkout.Session, "create", crear)
    pasarela = StripeGateway(Settings(stripe_secret_key="sk_test_x", currency="uyu"))

    sesion = pasarela.abrir_sesion(orden_de_prueba(), "https://tienda/pedidos/7?pago=exitoso", "https://tienda/carrito")

    assert sesion.checkout_url == "https://checkout.stripe.com/cs_test_1"
    assert enviado["success_url"].endswith("&session_id={CHECKOUT_SESSION_ID}")
    assert [linea["price_data"]["unit_amount"] for linea in enviado["line_items"]] == [259500, 29000]
    assert enviado["metadata"] == {"order_id": "7"}
    assert enviado["expires_at"] >= time.time() + 30 * 60


def test_stripe_traduce_sus_errores(monkeypatch):
    def fallar(**_datos):
        raise stripe.StripeError("tarjeta de la API invalida")

    monkeypatch.setattr(stripe.checkout.Session, "create", fallar)
    with pytest.raises(PaymentProviderError):
        StripeGateway(Settings(stripe_secret_key="sk_test_x")).abrir_sesion(orden_de_prueba(), "a", "b")


def test_stripe_consulta_si_la_sesion_esta_pagada(monkeypatch):
    monkeypatch.setattr(stripe.checkout.Session, "retrieve", lambda *_a, **_k: SimpleNamespace(payment_status="paid"))
    assert StripeGateway(Settings(stripe_secret_key="sk_test_x")).esta_pagada(orden_de_prueba()) is True

    sin_sesion = orden_de_prueba()
    sin_sesion.payment_session_id = None
    assert StripeGateway(Settings(stripe_secret_key="sk_test_x")).esta_pagada(sin_sesion) is False


def firmar_para_stripe(payload: bytes, secreto: str) -> str:
    marca = int(time.time())
    firma = hmac.new(secreto.encode(), f"{marca}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={marca},v1={firma}"


def test_webhook_de_stripe_marca_la_orden_pagada(api, headers_cliente, monkeypatch):
    from app.services import payments

    producto_id = crear_producto(stock=3)
    api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 1})
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]

    monkeypatch.setattr(payments, "obtener_config", lambda: Settings(stripe_webhook_secret="whsec_prueba"))
    evento = {
        "type": "checkout.session.completed",
        "data": {"object": {"payment_status": "paid", "metadata": {"order_id": str(orden_id)}}},
    }
    payload = json.dumps(evento).encode()
    respuesta = api.post("/api/checkout/webhook", content=payload, headers={"stripe-signature": firmar_para_stripe(payload, "whsec_prueba")})

    assert respuesta.status_code == 200
    assert api.get(f"/api/orders/{orden_id}", headers=headers_cliente).json()["status"] == "PAID"


def test_webhook_de_stripe_cancela_sesiones_vencidas(api, headers_cliente, monkeypatch):
    from app.services import payments

    producto_id = crear_producto(stock=3)
    api.post("/api/cart/items", headers=headers_cliente, json={"product_id": producto_id, "size": "9", "quantity": 2})
    orden_id = api.post("/api/checkout/session", headers=headers_cliente).json()["order_id"]

    monkeypatch.setattr(payments, "obtener_config", lambda: Settings(stripe_webhook_secret="whsec_prueba"))
    payload = json.dumps({"type": "checkout.session.expired", "data": {"object": {"metadata": {"order_id": str(orden_id)}}}}).encode()
    api.post("/api/checkout/webhook", content=payload, headers={"stripe-signature": firmar_para_stripe(payload, "whsec_prueba")})

    assert api.get(f"/api/orders/{orden_id}", headers=headers_cliente).json()["status"] == "CANCELLED"
    with SessionFactory() as database:
        assert database.get(Product, producto_id).stock == 3


class ClienteS3Falso:
    def __init__(self):
        self.objetos = {}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objetos[(Bucket, Key)] = (Body, ContentType)

    def delete_object(self, Bucket, Key):
        self.objetos.pop((Bucket, Key), None)

    def generate_presigned_url(self, operacion, Params, ExpiresIn):
        return f"https://firmada/{Params['Bucket']}/{Params['Key']}?vence={ExpiresIn}"


def storage_s3(monkeypatch, url_publica=None):
    import boto3

    cliente = ClienteS3Falso()
    monkeypatch.setattr(boto3, "client", lambda *_a, **_k: cliente)
    storage = S3Storage("product-images", "ca-central-1", "https://s3.test", "clave", "secreto", 3600, url_publica)
    return storage, cliente


def test_s3_guarda_y_borra_objetos(monkeypatch):
    storage, cliente = storage_s3(monkeypatch)
    storage.guardar("products/a.jpg", b"jpg", "image/jpeg")
    assert cliente.objetos[("product-images", "products/a.jpg")] == (b"jpg", "image/jpeg")
    storage.borrar("products/a.jpg")
    assert cliente.objetos == {}


def test_s3_con_bucket_publico_arma_la_url_directa(monkeypatch):
    storage, _ = storage_s3(monkeypatch, "https://ref.supabase.co/storage/v1/object/public/product-images/")
    assert storage.url_publica("products/a.jpg") == "https://ref.supabase.co/storage/v1/object/public/product-images/products/a.jpg"


def test_s3_con_bucket_privado_usa_url_firmada(monkeypatch):
    storage, _ = storage_s3(monkeypatch)
    assert storage.url_publica("products/a.jpg") == "https://firmada/product-images/products/a.jpg?vence=3600"


def test_el_seed_se_puede_correr_varias_veces(monkeypatch):
    from app import seed

    monkeypatch.setattr(seed, "descargar_imagen", lambda url: b"\xff\xd8\xff" + b"0" * 32)
    seed.ejecutar()
    seed.ejecutar()

    with SessionFactory() as database:
        assert database.query(User).filter_by(role="ADMIN").count() == 1
        assert database.query(Product).count() == len(seed.CATALOG)
        assert all(not producto.image_key.startswith("http") for producto in database.query(Product))
