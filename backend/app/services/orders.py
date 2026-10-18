from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import obtener_config
from app.models import CartItem, Order, OrderItem, OrderStatus, Product, User, ahora_utc
from app.services.pricing import calcular_totales


def items_del_carrito(database: Session, user: User) -> List[CartItem]:
    statement = select(CartItem).where(CartItem.user_id == user.id).order_by(CartItem.id)
    return list(database.scalars(statement))


def cancelar_ordenes_pendientes(database: Session, user: User) -> None:
    # si el usuario arranca otro pago, las ordenes que quedaron colgadas ya no sirven
    statement = select(Order).where(Order.user_id == user.id, Order.status == OrderStatus.PENDING)
    for stale_order in database.scalars(statement):
        stale_order.status = OrderStatus.CANCELLED


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
    database.add(order)
    database.flush()  # flush para tener el id antes de mandarlo a stripe
    return order


def marcar_orden_pagada(database: Session, order: Order) -> Order:
    # puede llegar dos veces (la vuelta del navegador y el webhook), la segunda no tiene que hacer nada
    if order.status == OrderStatus.PAID:
        return order
    purchased_lines = set()
    for order_item in order.items:
        product = database.get(Product, order_item.product_id)
        product.stock = max(0, product.stock - order_item.quantity)  # que nunca quede negativo
        purchased_lines.add((order_item.product_id, order_item.size))

    # saco del carrito solo lo que se compro, si agrego algo despues lo dejo
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
        order.status = OrderStatus.CANCELLED
        database.commit()
    return order
