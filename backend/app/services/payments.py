import json
from dataclasses import dataclass
from typing import Optional, Protocol

import stripe

from app.config import Settings, get_settings
from app.models import Order


class PaymentProviderError(Exception):
    pass


@dataclass(frozen=True)
class PaymentSession:
    session_id: str
    checkout_url: str


class PaymentGateway(Protocol):
    def open_session(self, order: Order, success_url: str, cancel_url: str) -> PaymentSession: ...

    def is_paid(self, order: Order) -> bool: ...


class StripeGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    def open_session(self, order: Order, success_url: str, cancel_url: str) -> PaymentSession:
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
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=str(order.id),
                metadata={"order_id": str(order.id)},
            )
        except stripe.StripeError as error:
            raise PaymentProviderError(str(error)) from error
        return PaymentSession(session_id=session.id, checkout_url=session.url)

    def is_paid(self, order: Order) -> bool:
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

    def open_session(self, order: Order, success_url: str, cancel_url: str) -> PaymentSession:
        session_id = f"sim_{order.id}"
        return PaymentSession(
            session_id=session_id,
            checkout_url=f"{self.settings.public_base_url}/#/pago-simulado/{order.id}",
        )

    def is_paid(self, order: Order) -> bool:
        return order.status.value == "PAID"


def get_payment_gateway() -> PaymentGateway:
    settings = get_settings()
    return StripeGateway(settings) if settings.uses_stripe else SimulatedGateway(settings)


def read_stripe_event(payload: bytes, signature_header: Optional[str]):
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise PaymentProviderError("Webhook de Stripe sin configurar")
    try:
        stripe.Webhook.construct_event(payload, signature_header or "", settings.stripe_webhook_secret)
        return json.loads(payload)
    except (ValueError, stripe.SignatureVerificationError) as error:
        raise PaymentProviderError("Firma de webhook inválida") from error
