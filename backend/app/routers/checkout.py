from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_database_session
from app.dependencies import get_current_user
from app.models import Order, OrderStatus, User
from app.schemas import CheckoutOut, OrderOut, SimulatedPaymentRequest
from app.services.orders import (
    cancel_order,
    cancel_stale_pending_orders,
    create_pending_order,
    load_cart_items,
    mark_order_paid,
)
from app.services.payments import PaymentGateway, PaymentProviderError, get_payment_gateway, read_stripe_event
from app.services.presenters import describe_cart_item_problem, present_order

router = APIRouter(prefix="/api/checkout", tags=["Checkout"])

APPROVED_TEST_CARD = "4242424242424242"
DECLINED_TEST_CARD = "4000000000000002"


def find_owned_order(database: Session, user: User, order_id: int) -> Order:
    order = database.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa orden.")
    return order


@router.post("/session", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED)
def start_checkout(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
    gateway: PaymentGateway = Depends(get_payment_gateway),
):
    cart_items = load_cart_items(database, user)
    if not cart_items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tu carrito está vacío.")
    for item in cart_items:
        problem = describe_cart_item_problem(item)
        if problem:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{item.product.name}: {problem}")

    cancel_stale_pending_orders(database, user)
    order = create_pending_order(database, user, cart_items)

    base_url = get_settings().public_base_url
    try:
        payment_session = gateway.open_session(
            order,
            success_url=f"{base_url}/#/pedidos/{order.id}?pago=exitoso&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/#/carrito?pago=cancelado&orden={order.id}",
        )
    except PaymentProviderError:
        order.status = OrderStatus.CANCELLED
        database.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No pudimos iniciar el pago. Prueba de nuevo en unos minutos.")

    order.payment_session_id = payment_session.session_id
    database.commit()
    return CheckoutOut(order_id=order.id, checkout_url=payment_session.checkout_url)


@router.post("/orders/{order_id}/confirm", response_model=OrderOut)
def confirm_payment(
    order_id: int,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
    gateway: PaymentGateway = Depends(get_payment_gateway),
):
    order = find_owned_order(database, user, order_id)
    if order.status == OrderStatus.PENDING:
        try:
            if gateway.is_paid(order):
                mark_order_paid(database, order)
        except PaymentProviderError:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No pudimos verificar el pago todavía.")
    return present_order(order)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def abandon_checkout(
    order_id: int,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    return present_order(cancel_order(database, find_owned_order(database, user, order_id)))


@router.post("/simulated/{order_id}/pay", response_model=OrderOut)
def pay_with_simulated_card(
    order_id: int,
    request: SimulatedPaymentRequest,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    if get_settings().uses_stripe:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado.")
    order = find_owned_order(database, user, order_id)
    if order.status != OrderStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "Esta orden ya no admite pagos.")

    card_number = "".join(character for character in request.card_number if character.isdigit())
    if card_number == DECLINED_TEST_CARD:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "El banco rechazó la tarjeta.")
    if card_number != APPROVED_TEST_CARD:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Número de tarjeta inválido.")
    return present_order(mark_order_paid(database, order))


@router.post("/webhook", include_in_schema=True)
async def receive_stripe_webhook(request: Request, database: Session = Depends(get_database_session)):
    try:
        event = read_stripe_event(await request.body(), request.headers.get("stripe-signature"))
    except PaymentProviderError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error))

    session_data = event["data"]["object"]
    order_id = (session_data.get("metadata") or {}).get("order_id")
    order = database.get(Order, int(order_id)) if order_id else None
    if order is not None:
        if event["type"] == "checkout.session.completed" and session_data.get("payment_status") == "paid":
            mark_order_paid(database, order)
        elif event["type"] == "checkout.session.expired":
            cancel_order(database, order)
    return {"received": True}
