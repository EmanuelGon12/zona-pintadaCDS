from collections import defaultdict
from datetime import timedelta
from typing import Dict, List

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.config import obtener_config
from app.models import CartItem, Order, OrderItem, OrderStatus, Product, User, ahora_utc
from app.services.pricing import calcular_totales


class StockAgotado(Exception):
    def __init__(self, nombre_producto: str):
        super().__init__(nombre_producto)
        self.nombre_producto = nombre_producto


def items_del_carrito(database: Session, user: User) -> List[CartItem]:
    statement = (
        select(CartItem).where(CartItem.user_id == user.id).options(selectinload(CartItem.product)).order_by(CartItem.id)
    )
    return list(database.scalars(statement))


def reservas_del_usuario(database: Session, user: User) -> Dict[int, int]:
    # cuanto stock tiene apartado este usuario en pagos que todavia no termino
    reservado: Dict[int, int] = defaultdict(int)
    statement = (
        select(OrderItem)
        .join(Order)
        .where(Order.user_id == user.id, Order.status == OrderStatus.PENDING)
    )
    for item in database.scalars(statement):
        reservado[item.product_id] += item.quantity
    return reservado


def devolver_stock(database: Session, order: Order) -> None:
    for item in order.items:
        database.execute(
            update(Product).where(Product.id == item.product_id).values(stock=Product.stock + item.quantity)
        )


def descontar_stock(database: Session, order_items) -> None:
    # el WHERE stock >= cantidad hace que sea atomico: si dos compran la ultima unidad a la vez
    # solo uno logra actualizar la fila, el otro recibe 0 filas y le avisamos que se agoto
    for item in order_items:
        resultado = database.execute(
            update(Product)
            .where(Product.id == item.product_id, Product.stock >= item.quantity)
            .values(stock=Product.stock - item.quantity)
        )
        if resultado.rowcount == 0:
            raise StockAgotado(item.product_name)


def cancelar_ordenes_pendientes(database: Session, user: User) -> None:
    # si el usuario arranca otro pago, las ordenes que quedaron colgadas ya no sirven y su stock vuelve
    statement = select(Order).where(Order.user_id == user.id, Order.status == OrderStatus.PENDING)
    for stale_order in database.scalars(statement):
        devolver_stock(database, stale_order)
        stale_order.status = OrderStatus.CANCELLED


def liberar_reservas_vencidas(database: Session) -> int:
    # nadie corre un cron, asi que esto se llama al agregar al carrito y al iniciar un pago
    limite = ahora_utc() - timedelta(minutes=obtener_config().reservation_minutes)
    vencidas = list(database.scalars(select(Order).where(Order.status == OrderStatus.PENDING, Order.created_at < limite)))
    for order in vencidas:
        devolver_stock(database, order)
        order.status = OrderStatus.CANCELLED
    if vencidas:
        database.commit()
    return len(vencidas)


def crear_orden_pendiente(database: Session, user: User, cart_items: List[CartItem]) -> Order:
    totals = calcular_totales(
        ((item.product.price_cents, item.quantity) for item in cart_items), obtener_config()
    )
    order = Order(
        user_id=user.id,
        status=OrderStatus.PENDING,
        subtotal_cents=totals.subtotal_cents,
        shipping_cents=totals.shipping_cents,
        total_cents=totals.total_cents,
        items=[
            OrderItem(
                product_id=item.product_id,
                product_name=item.product.name,
                image_key=item.product.image_key,
                size=item.size,
                quantity=item.quantity,
                unit_price_cents=item.product.price_cents,
            )
            for item in cart_items
        ],
    )
    descontar_stock(database, order.items)  # reserva el stock mientras paga
    database.add(order)
    database.flush()  # flush para tener el id antes de mandarlo a la pasarela
    return order


def marcar_orden_pagada(database: Session, order: Order) -> Order:
    # puede llegar dos veces (la vuelta del navegador y el webhook), la segunda no tiene que hacer nada
    if order.status == OrderStatus.PAID:
        return order

    if order.status == OrderStatus.CANCELLED:
        # el pago llego tarde, cuando la reserva ya se habia liberado. La plata ya esta cobrada,
        # asi que la orden vale igual y vuelvo a descontar (sin dejar el stock negativo)
        for item in order.items:
            product = database.get(Product, item.product_id)
            product.stock = max(0, product.stock - item.quantity)

    # saco del carrito solo lo que se compro, si agrego algo despues lo dejo
    purchased_lines = {(item.product_id, item.size) for item in order.items}
    buyer = database.get(User, order.user_id)
    for cart_item in items_del_carrito(database, buyer):
        if (cart_item.product_id, cart_item.size) in purchased_lines:
            database.delete(cart_item)

    order.status = OrderStatus.PAID
    order.paid_at = ahora_utc()
    database.commit()
    return order


def cancelar_orden(database: Session, order: Order) -> Order:
    if order.status == OrderStatus.PENDING:
        devolver_stock(database, order)
        order.status = OrderStatus.CANCELLED
        database.commit()
    return order
