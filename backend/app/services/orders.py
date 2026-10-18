from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import CartItem, Order, OrderItem, OrderStatus, Product, User, current_utc_time
from app.services.pricing import calculate_totals


def load_cart_items(database: Session, user: User) -> List[CartItem]:
    statement = select(CartItem).where(CartItem.user_id == user.id).order_by(CartItem.id)
    return list(database.scalars(statement))


def cancel_stale_pending_orders(database: Session, user: User) -> None:
    statement = select(Order).where(Order.user_id == user.id, Order.status == OrderStatus.PENDING)
    for stale_order in database.scalars(statement):
        stale_order.status = OrderStatus.CANCELLED


def create_pending_order(database: Session, user: User, cart_items: List[CartItem]) -> Order:
    totals = calculate_totals(
        ((item.product.price_cents, item.quantity) for item in cart_items), get_settings()
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
    database.flush()
    return order


def mark_order_paid(database: Session, order: Order) -> Order:
    if order.status == OrderStatus.PAID:
        return order

    purchased_lines = set()
    for order_item in order.items:
        product = database.get(Product, order_item.product_id)
        product.stock = max(0, product.stock - order_item.quantity)
        purchased_lines.add((order_item.product_id, order_item.size))

    buyer = database.get(User, order.user_id)
    for cart_item in load_cart_items(database, buyer):
        if (cart_item.product_id, cart_item.size) in purchased_lines:
            database.delete(cart_item)

    order.status = OrderStatus.PAID
    order.paid_at = current_utc_time()
    database.commit()
    return order


def cancel_order(database: Session, order: Order) -> Order:
    if order.status == OrderStatus.PENDING:
        order.status = OrderStatus.CANCELLED
        database.commit()
    return order
