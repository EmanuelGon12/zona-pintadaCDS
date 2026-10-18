from dataclasses import dataclass
from typing import Iterable, Tuple

from app.config import Settings


@dataclass(frozen=True)
class OrderTotals:
    subtotal_cents: int
    shipping_cents: int
    total_cents: int


def calculate_totals(unit_price_and_quantity: Iterable[Tuple[int, int]], settings: Settings) -> OrderTotals:
    subtotal_cents = sum(unit_price * quantity for unit_price, quantity in unit_price_and_quantity)
    if subtotal_cents == 0 or subtotal_cents >= settings.free_shipping_threshold_cents:
        shipping_cents = 0
    else:
        shipping_cents = settings.flat_shipping_cents
    return OrderTotals(subtotal_cents, shipping_cents, subtotal_cents + shipping_cents)
