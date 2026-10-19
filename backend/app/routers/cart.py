from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import obtener_config
from app.database import obtener_sesion_db
from app.dependencies import usuario_actual
from app.models import CartItem, Product, User
from app.schemas import CartItemCreate, CartItemUpdate, CartOut
from app.services.orders import items_del_carrito, liberar_reservas_vencidas, reservas_del_usuario
from app.services.presenters import presentar_carrito

router = APIRouter(prefix="/api/cart", tags=["Carrito"])


def validar_producto_para_carrito(product: Product, size: str, requested_quantity: int, reservado: int = 0) -> None:
    if not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese producto.")
    if size not in product.available_sizes:
        raise HTTPException(422, "Esa talla no está disponible para este modelo.")
    if requested_quantity > obtener_config().max_units_per_line:
        raise HTTPException(
            422,
            f"Puedes llevar hasta {obtener_config().max_units_per_line} unidades por talla.",
        )
    disponible = product.stock + reservado
    if requested_quantity > disponible:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No hay stock suficiente." if disponible == 0 else f"Solo quedan {disponible} unidades.",
        )


def carrito_de(database: Session, user: User):
    return presentar_carrito(items_del_carrito(database, user), reservas_del_usuario(database, user))


def buscar_item_propio(database: Session, user: User, item_id: int) -> CartItem:
    item = database.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese producto no está en tu carrito.")
    return item


@router.get("", response_model=CartOut)
def ver_carrito(user: User = Depends(usuario_actual), database: Session = Depends(obtener_sesion_db)):
    return carrito_de(database, user)


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
def agregar_item(
    request: CartItemCreate,
    user: User = Depends(usuario_actual),
    database: Session = Depends(obtener_sesion_db),
):
    liberar_reservas_vencidas(database)
    product = database.get(Product, request.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese producto.")

    existing_item = database.scalar(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.product_id == product.id, CartItem.size == request.size
        )
    )
    # si ya tenia ese talle en el carrito sumo, y valido el total contra el stock
    resulting_quantity = request.quantity + (existing_item.quantity if existing_item else 0)
    validar_producto_para_carrito(product, request.size, resulting_quantity, reservas_del_usuario(database, user).get(product.id, 0))

    if existing_item:
        existing_item.quantity = resulting_quantity
    else:
        database.add(CartItem(user_id=user.id, product_id=product.id, size=request.size, quantity=request.quantity))
    database.commit()
    return carrito_de(database, user)


@router.patch("/items/{item_id}", response_model=CartOut)
def cambiar_cantidad(
    item_id: int,
    request: CartItemUpdate,
    user: User = Depends(usuario_actual),
    database: Session = Depends(obtener_sesion_db),
):
    liberar_reservas_vencidas(database)
    item = buscar_item_propio(database, user, item_id)
    reservado = reservas_del_usuario(database, user).get(item.product_id, 0)
    validar_producto_para_carrito(item.product, item.size, request.quantity, reservado)
    item.quantity = request.quantity
    database.commit()
    return carrito_de(database, user)


@router.delete("/items/{item_id}", response_model=CartOut)
def quitar_item(
    item_id: int,
    user: User = Depends(usuario_actual),
    database: Session = Depends(obtener_sesion_db),
):
    database.delete(buscar_item_propio(database, user, item_id))
    database.commit()
    return carrito_de(database, user)
