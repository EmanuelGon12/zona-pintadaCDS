import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional, Protocol

import httpx
import stripe

from app.config import Settings, obtener_config
from app.models import Order, ahora_utc


class PaymentProviderError(Exception):
    pass


@dataclass(frozen=True)
class PaymentSession:
    session_id: str
    checkout_url: str


class PaymentGateway(Protocol):
    def abrir_sesion(self, order: Order, success_url: str, cancel_url: str) -> PaymentSession: ...

    def esta_pagada(self, order: Order) -> bool: ...


class StripeGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    def abrir_sesion(self, order: Order, success_url: str, cancel_url: str) -> PaymentSession:
        line_items = [
            {
                "quantity": item.quantity,
                "price_data": {
                    "currency": self.settings.currency,
                    "unit_amount": item.unit_price_cents,
                    "product_data": {"name": f"{item.product_name} · Talla {item.size}"},
                },
            }
            for item in order.items
        ]
        if order.shipping_cents:
            line_items.append(
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": self.settings.currency,
                        "unit_amount": order.shipping_cents,
                        "product_data": {"name": "Envío"},
                    },
                }
            )
        try:
            session = stripe.checkout.Session.create(
                api_key=self.settings.stripe_secret_key,
                mode="payment",
                line_items=line_items,
                success_url=success_url + "&session_id={CHECKOUT_SESSION_ID}",
                cancel_url=cancel_url,
                client_reference_id=str(order.id),
                # stripe pide minimo 30 minutos, lo alineo con la reserva de stock
                expires_at=int(time.time()) + max(31, self.settings.reservation_minutes) * 60,
                metadata={"order_id": str(order.id)},
            )
        except stripe.StripeError as error:
            raise PaymentProviderError(str(error)) from error
        return PaymentSession(session_id=session.id, checkout_url=session.url)

    def esta_pagada(self, order: Order) -> bool:
        if not order.payment_session_id:
            return False
        try:
            session = stripe.checkout.Session.retrieve(order.payment_session_id, api_key=self.settings.stripe_secret_key)
        except stripe.StripeError as error:
            raise PaymentProviderError(str(error)) from error
        return session.payment_status == "paid"


class SimulatedGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    def abrir_sesion(self, order: Order, success_url: str, cancel_url: str) -> PaymentSession:
        session_id = f"sim_{order.id}"
        return PaymentSession(
            session_id=session_id,
            checkout_url='/pago-simulado/' + str(order.id),  # ruta del front, no hace falta la url completa
        )

    def esta_pagada(self, order: Order) -> bool:
        return order.status.value == "PAID"


class MercadoPagoGateway:
    API = "https://api.mercadopago.com"

    def __init__(self, settings: Settings, http: Optional[httpx.Client] = None):
        self.settings = settings
        self.http = http or httpx.Client(base_url=self.API, timeout=15)

    def _headers(self):
        return {"Authorization": f"Bearer {self.settings.mercadopago_access_token}"}

    def _pedir(self, metodo, ruta, **opciones):
        try:
            respuesta = self.http.request(metodo, ruta, headers=self._headers(), **opciones)
            respuesta.raise_for_status()
        except httpx.HTTPError as error:
            raise PaymentProviderError(str(error)) from error
        return respuesta.json()

    def abrir_sesion(self, order: Order, success_url: str, cancel_url: str) -> PaymentSession:
        items = [
            {
                "id": str(item.product_id),
                "title": f"{item.product_name} · Talla {item.size}",
                "quantity": item.quantity,
                "unit_price": item.unit_price_cents / 100,
                "currency_id": "UYU",
            }
            for item in order.items
        ]
        if order.shipping_cents:
            items.append({"id": "envio", "title": "Envío", "quantity": 1, "unit_price": order.shipping_cents / 100, "currency_id": "UYU"})

        preferencia = {
            "items": items,
            "external_reference": str(order.id),  # con esto despues buscamos el pago de la orden
            "back_urls": {"success": success_url, "pending": success_url, "failure": cancel_url},
            "statement_descriptor": "ZONA PINTADA",
            # que no se pueda pagar despues de que se libera la reserva de stock
            "expires": True,
            "expiration_date_to": (ahora_utc() + timedelta(minutes=self.settings.reservation_minutes)).isoformat(timespec="milliseconds"),
        }
        # mercado pago no acepta auto_return ni notificaciones a localhost, solo con la url publica (vercel)
        base_url = self.settings.public_base_url
        if base_url.startswith("https://"):
            preferencia["auto_return"] = "approved"
            preferencia["notification_url"] = f"{base_url}/api/checkout/webhook/mercadopago"

        datos = self._pedir("POST", "/checkout/preferences", json=preferencia)
        return PaymentSession(session_id=datos["id"], checkout_url=datos["init_point"])

    def esta_pagada(self, order: Order) -> bool:
        datos = self._pedir("GET", "/v1/payments/search", params={"external_reference": str(order.id), "status": "approved"})
        return any(pago.get("status") == "approved" for pago in datos.get("results", []))

    def consultar_pago(self, pago_id: str) -> dict:
        return self._pedir("GET", f"/v1/payments/{pago_id}")


def obtener_pasarela() -> PaymentGateway:
    settings = obtener_config()
    if settings.pasarela == "mercadopago":
        return MercadoPagoGateway(settings)
    if settings.pasarela == "stripe":
        return StripeGateway(settings)
    return SimulatedGateway(settings)


def firma_mercadopago_valida(secreto: str, encabezado_firma: Optional[str], request_id: Optional[str], pago_id: str) -> bool:
    # el header viene asi: "ts=1704908010,v1=618c8534..." y se firma "id:...;request-id:...;ts:...;"
    partes = dict(parte.strip().split("=", 1) for parte in (encabezado_firma or "").split(",") if "=" in parte)
    if "ts" not in partes or "v1" not in partes:
        return False
    manifiesto = f"id:{pago_id.lower()};request-id:{request_id or ''};ts:{partes['ts']};"
    esperada = hmac.new(secreto.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, partes["v1"])


def leer_evento_stripe(payload: bytes, signature_header: Optional[str]):
    settings = obtener_config()
    if not settings.stripe_webhook_secret:
        raise PaymentProviderError("Webhook de Stripe sin configurar")
    try:
        stripe.Webhook.construct_event(payload, signature_header or "", settings.stripe_webhook_secret)
        return json.loads(payload)
    except (ValueError, stripe.SignatureVerificationError) as error:
        raise PaymentProviderError("Firma de webhook inválida") from error
