import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import obtener_config
from app.database import obtener_sesion_db
from app.dependencies import usuario_actual
from app.models import Order, OrderStatus, User
from app.schemas import CheckoutOut, OrderOut, SimulatedPaymentRequest
from app.services.orders import (
    StockAgotado,
    cancelar_orden,
    cancelar_ordenes_pendientes,
    crear_orden_pendiente,
    devolver_stock,
    items_del_carrito,
    liberar_reservas_vencidas,
    marcar_orden_pagada,
)
from app.services.payments import (
    MercadoPagoGateway,
    PaymentGateway,
    PaymentProviderError,
    firma_mercadopago_valida,
    obtener_pasarela,
)
from app.services.presenters import problema_del_item, presentar_orden

router = APIRouter(prefix="/api/checkout", tags=["Checkout"])
logger = logging.getLogger(__name__)

# tarjetas de prueba del simulador (las mismas que usan las pasarelas en sus ejemplos)
APPROVED_TEST_CARD = "4242424242424242"
DECLINED_TEST_CARD = "4000000000000002"


def buscar_orden_propia(database: Session, user: User, order_id: int) -> Order:
    order = database.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa orden.")
    return order


@router.post("/session", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED)
def iniciar_checkout(
    user: User = Depends(usuario_actual),
    database: Session = Depends(obtener_sesion_db),
    gateway: PaymentGateway = Depends(obtener_pasarela),
):
    liberar_reservas_vencidas(database)
    # primero suelto lo que este usuario tenia reservado de un pago anterior, si no se bloquea a si mismo
    cancelar_ordenes_pendientes(database, user)
    database.flush()

    cart_items = items_del_carrito(database, user)
    if not cart_items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tu carrito está vacío.")
    # vuelvo a validar todo aca, el carrito pudo cambiar desde que se agrego (stock, producto oculto, etc)
    for item in cart_items:
        database.refresh(item.product)
        problem = problema_del_item(item)
        if problem:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{item.product.name}: {problem}")

    try:
        order = crear_orden_pendiente(database, user, cart_items)
    except StockAgotado as agotado:
        database.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"{agotado.nombre_producto}: se agotó mientras comprabas.") from agotado

    base_url = obtener_config().public_base_url
    try:
        payment_session = gateway.abrir_sesion(
            order,
            success_url=f"{base_url}/pedidos/{order.id}?pago=exitoso",
            cancel_url=f"{base_url}/carrito?pago=cancelado&orden={order.id}",
        )
    except PaymentProviderError as error:
        # la pasarela fallo, no dejo la orden pendiente para siempre y libero lo reservado
        devolver_stock(database, order)
        order.status = OrderStatus.CANCELLED
        database.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No pudimos iniciar el pago. Prueba de nuevo en unos minutos.") from error

    order.payment_session_id = payment_session.session_id
    database.commit()
    return CheckoutOut(order_id=order.id, checkout_url=payment_session.checkout_url)


@router.post("/orders/{order_id}/confirm", response_model=OrderOut)
def confirmar_pago(
    order_id: int,
    user: User = Depends(usuario_actual),
    database: Session = Depends(obtener_sesion_db),
    gateway: PaymentGateway = Depends(obtener_pasarela),
):
    order = buscar_orden_propia(database, user, order_id)
    # tambien reviso las canceladas: el pago pudo aprobarse justo despues de que vencio la reserva
    if order.status != OrderStatus.PAID:
        try:
            if gateway.esta_pagada(order):
                marcar_orden_pagada(database, order)
        except PaymentProviderError as error:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No pudimos verificar el pago todavía.") from error
    return presentar_orden(order)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def abandonar_checkout(
    order_id: int,
    user: User = Depends(usuario_actual),
    database: Session = Depends(obtener_sesion_db),
):
    return presentar_orden(cancelar_orden(database, buscar_orden_propia(database, user, order_id)))


@router.post("/simulated/{order_id}/pay", response_model=OrderOut)
def pagar_con_tarjeta_simulada(
    order_id: int,
    request: SimulatedPaymentRequest,
    user: User = Depends(usuario_actual),
    database: Session = Depends(obtener_sesion_db),
):
    if obtener_config().pasarela != "simulada":  # con una pasarela real este endpoint no existe
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado.")
    liberar_reservas_vencidas(database)
    order = buscar_orden_propia(database, user, order_id)
    database.refresh(order)
    if order.status != OrderStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "Esta orden ya no admite pagos.")

    card_number = ''.join(c for c in request.card_number if c.isdigit())
    if card_number == DECLINED_TEST_CARD:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "El banco rechazó la tarjeta.")
    if card_number != APPROVED_TEST_CARD:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Número de tarjeta inválido.")
    return presentar_orden(marcar_orden_pagada(database, order))


# mercado pago avisa aca cada vez que cambia un pago. No confiamos en lo que manda:
# con el id consultamos el pago a su api y recien ahi marcamos la orden
@router.post("/webhook/mercadopago")
async def recibir_webhook_mercadopago(request: Request, database: Session = Depends(obtener_sesion_db)):
    try:
        cuerpo = await request.json()
    except ValueError:
        cuerpo = {}
    if not isinstance(cuerpo, dict):
        cuerpo = {}

    tipo = request.query_params.get("type") or request.query_params.get("topic") or cuerpo.get("type")
    pago_id = request.query_params.get("data.id") or (cuerpo.get("data") or {}).get("id")
    if tipo != "payment" or not pago_id:
        return {"received": True}
    pago_id = str(pago_id)

    config = obtener_config()
    if config.mercadopago_webhook_secret and not firma_mercadopago_valida(
        config.mercadopago_webhook_secret,
        request.headers.get("x-signature"),
        request.headers.get("x-request-id"),
        pago_id,
    ):
        logger.warning("webhook de mercado pago con firma invalida (pago %s)", pago_id)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Firma inválida")

    gateway = obtener_pasarela()
    if not isinstance(gateway, MercadoPagoGateway):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mercado Pago no está configurado")

    try:
        pago = await run_in_threadpool(gateway.consultar_pago, pago_id)
    except PaymentProviderError as error:
        # devolver error hace que mercado pago reintente mas tarde
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No pudimos consultar el pago") from error

    referencia = str(pago.get("external_reference") or "")
    order = database.get(Order, int(referencia)) if referencia.isdigit() else None
    logger.info("webhook mercado pago: pago %s %s, orden %s", pago_id, pago.get("status"), referencia or "-")
    if order is not None and pago.get("status") == "approved":
        marcar_orden_pagada(database, order)
    return {"received": True}
