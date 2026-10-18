from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_database_session
from app.dependencies import get_current_user
from app.models import CartItem, Product, User
from app.schemas import CartItemCreate, CartItemUpdate, CartOut
from app.services.orders import load_cart_items
from app.services.presenters import present_cart

router = APIRouter(prefix="/api/cart", tags=["Carrito"])


def ensure_product_can_be_added(product: Product, size: str, requested_quantity: int) -> None:
    if not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese producto.")
    if size not in product.available_sizes:
        raise HTTPException(422, "Esa talla no está disponible para este modelo.")
    if requested_quantity > get_settings().max_units_per_line:
        raise HTTPException(
            422,
            f"Puedes llevar hasta {get_settings().max_units_per_line} unidades por talla.",
        )
    if requested_quantity > product.stock:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No hay stock suficiente." if product.stock == 0 else f"Solo quedan {product.stock} unidades.",
        )


def find_owned_item(database: Session, user: User, item_id: int) -> CartItem:
    item = database.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese producto no está en tu carrito.")
    return item


@router.get("", response_model=CartOut)
def view_cart(user: User = Depends(get_current_user), database: Session = Depends(get_database_session)):
    return present_cart(load_cart_items(database, user))


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
def add_item(
    request: CartItemCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    product = database.get(Product, request.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese producto.")

    existing_item = database.scalar(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.product_id == product.id, CartItem.size == request.size
        )
    )
    resulting_quantity = request.quantity + (existing_item.quantity if existing_item else 0)
    ensure_product_can_be_added(product, request.size, resulting_quantity)

    if existing_item:
        existing_item.quantity = resulting_quantity
    else:
        database.add(CartItem(user_id=user.id, product_id=product.id, size=request.size, quantity=request.quantity))
    database.commit()
    return present_cart(load_cart_items(database, user))


@router.patch("/items/{item_id}", response_model=CartOut)
def change_item_quantity(
    item_id: int,
    request: CartItemUpdate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    item = find_owned_item(database, user, item_id)
    ensure_product_can_be_added(item.product, item.size, request.quantity)
    item.quantity = request.quantity
    database.commit()
    return present_cart(load_cart_items(database, user))


@router.delete("/items/{item_id}", response_model=CartOut)
def remove_item(
    item_id: int,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    database.delete(find_owned_item(database, user, item_id))
    database.commit()
    return present_cart(load_cart_items(database, user))
