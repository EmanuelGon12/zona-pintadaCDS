from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_database_session
from app.dependencies import get_current_user
from app.models import Order, User
from app.schemas import OrderOut
from app.services.presenters import present_order

router = APIRouter(prefix="/api/orders", tags=["Órdenes"])


@router.get("", response_model=List[OrderOut])
def list_my_orders(user: User = Depends(get_current_user), database: Session = Depends(get_database_session)):
    statement = select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc(), Order.id.desc())
    return [present_order(order) for order in database.scalars(statement)]


@router.get("/{order_id}", response_model=OrderOut)
def get_my_order(order_id: int, user: User = Depends(get_current_user), database: Session = Depends(get_database_session)):
    order = database.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa orden.")
    return present_order(order)
