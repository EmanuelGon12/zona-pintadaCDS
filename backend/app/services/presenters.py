from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.models import CartItem, Order, OrderItem, Product, ahora_utc
from app.schemas import CartLineOut, CartOut, OrderItemOut, OrderOut, ProductOut
from app.services.pricing import calcular_totales
from app.storage import obtener_storage, es_imagen_externa
from app.config import obtener_config


def url_de_imagen(image_key: Optional[str]) -> Optional[str]:
    if not image_key:
        return None
    return image_key if es_imagen_externa(image_key) else obtener_storage().url_publica(image_key)


NEW_ARRIVAL_WINDOW = timedelta(days=30)


# sqlite devuelve las fechas sin zona horaria, postgres no. Asi quedan iguales
def en_utc(moment: datetime) -> datetime:
    return moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment


def es_novedad(product: Product) -> bool:
    return ahora_utc() - en_utc(product.created_at) <= NEW_ARRIVAL_WINDOW


def presentar_producto(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        colorway=product.colorway,
        description=product.description,
        price_cents=product.price_cents,
        stock=product.stock,
        available_sizes=list(product.available_sizes),
        image_url=url_de_imagen(product.image_key),
        play_style=product.play_style,
        surface=product.surface,
        is_new=es_novedad(product),
        created_at=en_utc(product.created_at),
        is_active=product.is_active,
    )


def problema_del_item(item: CartItem, reservado_por_el_usuario: int = 0) -> Optional[str]:
    product = item.product
    # lo que el mismo usuario tiene reservado en un pago sin terminar cuenta como disponible para el
    disponible = product.stock + reservado_por_el_usuario
    if not product.is_active:
        return "Este producto ya no está disponible."
    if item.size not in product.available_sizes:
        return "La talla elegida ya no está disponible."
    if disponible <= 0:
        return "Sin stock."
    if item.quantity > disponible:
        return f"Solo quedan {disponible} unidades."
    return None


def presentar_carrito(items: List[CartItem], reservas: Optional[Dict[int, int]] = None) -> CartOut:
    settings = obtener_config()
    reservas = reservas or {}
    lines = []
    for item in items:
        problem = problema_del_item(item, reservas.get(item.product_id, 0))
        lines.append(
            CartLineOut(
                id=item.id,
                product=presentar_producto(item.product),
                size=item.size,
                quantity=item.quantity,
                unit_price_cents=item.product.price_cents,
                line_total_cents=item.product.price_cents * item.quantity,
                is_purchasable=problem is None,
                problem=problem,
            )
        )
    totals = calcular_totales(((line.unit_price_cents, line.quantity) for line in lines), settings)
    return CartOut(
        lines=lines,
        item_count=sum(line.quantity for line in lines),
        subtotal_cents=totals.subtotal_cents,
        shipping_cents=totals.shipping_cents,
        total_cents=totals.total_cents,
        free_shipping_threshold_cents=settings.free_shipping_threshold_cents,
        can_checkout=bool(lines) and all(line.is_purchasable for line in lines),
    )


def presentar_item_orden(item: OrderItem) -> OrderItemOut:
    return OrderItemOut(
        product_id=item.product_id,
        product_name=item.product_name,
        image_url=url_de_imagen(item.image_key),
        size=item.size,
        quantity=item.quantity,
        unit_price_cents=item.unit_price_cents,
        line_total_cents=item.unit_price_cents * item.quantity,
    )


def presentar_orden(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        status=order.status,
        subtotal_cents=order.subtotal_cents,
        shipping_cents=order.shipping_cents,
        total_cents=order.total_cents,
        created_at=order.created_at,
        paid_at=order.paid_at,
        items=[presentar_item_orden(item) for item in order.items],
    )
