from datetime import datetime, timedelta, timezone
from typing import List, Optional

from app.models import CartItem, Order, OrderItem, Product, current_utc_time
from app.schemas import CartLineOut, CartOut, OrderItemOut, OrderOut, ProductOut
from app.services.pricing import calculate_totals
from app.storage import get_storage, is_external_image
from app.config import get_settings


def image_url_for(image_key: Optional[str]) -> Optional[str]:
    if not image_key:
        return None
    return image_key if is_external_image(image_key) else get_storage().public_url(image_key)


NEW_ARRIVAL_WINDOW = timedelta(days=30)


def as_utc(moment: datetime) -> datetime:
    return moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment


def is_new_arrival(product: Product) -> bool:
    return current_utc_time() - as_utc(product.created_at) <= NEW_ARRIVAL_WINDOW


def present_product(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        colorway=product.colorway,
        description=product.description,
        price_cents=product.price_cents,
        stock=product.stock,
        available_sizes=list(product.available_sizes),
        image_url=image_url_for(product.image_key),
        play_style=product.play_style,
        surface=product.surface,
        is_new=is_new_arrival(product),
        created_at=as_utc(product.created_at),
        is_active=product.is_active,
    )


def describe_cart_item_problem(item: CartItem) -> Optional[str]:
    product = item.product
    if not product.is_active:
        return "Este producto ya no está disponible."
    if item.size not in product.available_sizes:
        return "La talla elegida ya no está disponible."
    if product.stock <= 0:
        return "Sin stock."
    if item.quantity > product.stock:
        return f"Solo quedan {product.stock} unidades."
    return None


def present_cart(items: List[CartItem]) -> CartOut:
    settings = get_settings()
    lines = []
    for item in items:
        problem = describe_cart_item_problem(item)
        lines.append(
            CartLineOut(
                id=item.id,
                product=present_product(item.product),
                size=item.size,
                quantity=item.quantity,
                unit_price_cents=item.product.price_cents,
                line_total_cents=item.product.price_cents * item.quantity,
                is_purchasable=problem is None,
                problem=problem,
            )
        )
    totals = calculate_totals(((line.unit_price_cents, line.quantity) for line in lines), settings)
    return CartOut(
        lines=lines,
        item_count=sum(line.quantity for line in lines),
        subtotal_cents=totals.subtotal_cents,
        shipping_cents=totals.shipping_cents,
        total_cents=totals.total_cents,
        free_shipping_threshold_cents=settings.free_shipping_threshold_cents,
        can_checkout=bool(lines) and all(line.is_purchasable for line in lines),
    )


def present_order_item(item: OrderItem) -> OrderItemOut:
    return OrderItemOut(
        product_id=item.product_id,
        product_name=item.product_name,
        image_url=image_url_for(item.image_key),
        size=item.size,
        quantity=item.quantity,
        unit_price_cents=item.unit_price_cents,
        line_total_cents=item.unit_price_cents * item.quantity,
    )


def present_order(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        status=order.status,
        subtotal_cents=order.subtotal_cents,
        shipping_cents=order.shipping_cents,
        total_cents=order.total_cents,
        created_at=order.created_at,
        paid_at=order.paid_at,
        items=[present_order_item(item) for item in order.items],
    )
