from enum import Enum
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import obtener_sesion_db
from app.models import CourtSurface, PlayStyle, Product, normalizar_para_busqueda
from app.schemas import ProductOut, RecommendationOut
from app.services.presenters import presentar_producto
from app.services.recommendations import recomendar_productos, afinidad_superficie

router = APIRouter(prefix="/api/products", tags=["Catálogo"])


class CatalogOrder(str, Enum):
    NEWEST = "nuevos"
    PRICE_ASCENDING = "precio-asc"
    PRICE_DESCENDING = "precio-desc"


ORDERING = {
    CatalogOrder.NEWEST: (Product.created_at.desc(), Product.id.desc()),
    CatalogOrder.PRICE_ASCENDING: (Product.price_cents.asc(), Product.id.asc()),
    CatalogOrder.PRICE_DESCENDING: (Product.price_cents.desc(), Product.id.desc()),
}


@router.get("", response_model=List[ProductOut])
def listar_productos_activos(
    search: Optional[str] = Query(default=None, max_length=80, alias="q"),
    play_style: Optional[PlayStyle] = Query(default=None, alias="estilo"),
    order: CatalogOrder = Query(default=CatalogOrder.NEWEST, alias="orden"),
    limit: Optional[int] = Query(default=None, ge=1, le=50, alias="limite"),
    database: Session = Depends(obtener_sesion_db),
):
    statement = select(Product).where(Product.is_active.is_(True)).order_by(*ORDERING[order])
    if search and search.strip():
        escaped = normalizar_para_busqueda(search.strip()).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(Product.search_key.like(f"%{escaped}%", escape="\\"))
    if play_style:
        statement = statement.where(Product.play_style == play_style)
    if limit:
        statement = statement.limit(limit)
    return [presentar_producto(product) for product in database.scalars(statement)]


@router.get("/recommendations", response_model=List[RecommendationOut])
def recomendar_por_estilo(
    play_style: PlayStyle = Query(alias="estilo"),
    surface: CourtSurface = Query(alias="superficie"),
    database: Session = Depends(obtener_sesion_db),
):
    return [
        RecommendationOut(
            product=presentar_producto(product),
            matches_surface=afinidad_superficie(product.surface, surface) == 1.0,
        )
        for product in recomendar_productos(database, play_style, surface)
    ]


@router.get("/{product_id}", response_model=ProductOut)
def obtener_producto_activo(product_id: int, database: Session = Depends(obtener_sesion_db)):
    product = database.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese producto.")
    return presentar_producto(product)
