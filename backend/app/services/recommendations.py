from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CourtSurface, PlayStyle, Product

MAXIMUM_RECOMMENDATIONS = 3


# 1 = sirve para esa cancha, 0.5 = sirve pero no es lo ideal, 0 = no es para eso
def afinidad_superficie(product_surface: CourtSurface, desired_surface: CourtSurface) -> float:
    if desired_surface == CourtSurface.BOTH:
        return 1.0 if product_surface == CourtSurface.BOTH else 0.5
    if product_surface in (desired_surface, CourtSurface.BOTH):
        return 1.0
    return 0.0


def recomendar_productos(database: Session, play_style: PlayStyle, surface: CourtSurface) -> List[Product]:
    candidates = database.scalars(
        select(Product).where(
            Product.is_active.is_(True),
            Product.stock > 0,
            Product.play_style == play_style,
        )
    ).all()
    # primero las que mejor van con la superficie y despues la mas barata
    ranked = sorted(
        candidates,
        key=lambda product: (-afinidad_superficie(product.surface, surface), product.price_cents),
    )
    return ranked[:MAXIMUM_RECOMMENDATIONS]
