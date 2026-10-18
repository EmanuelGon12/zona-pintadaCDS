from typing import List

from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.database import obtener_sesion_db
from app.dependencies import usuario_actual
from app.models import Order, User
from app.schemas import OrderOut
from app.services.presenters import presentar_orden

router = APIRouter(prefix="/api/orders", tags=["Órdenes"])


@router.get("", response_model=List[OrderOut])
def listar_mis_ordenes(user: User = Depends(usuario_actual), database: Session = Depends(obtener_sesion_db)):
    statement = select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc(), Order.id.desc())
    return [presentar_orden(order) for order in database.scalars(statement)]


@router.get("/{order_id}", response_model=OrderOut)
def obtener_mi_orden(order_id: int, user: User = Depends(usuario_actual), database: Session = Depends(obtener_sesion_db)):
    order = database.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa orden.")
    return presentar_orden(order)
