from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import obtener_config
from app.database import obtener_sesion_db
from app.dependencies import requerir_admin
from app.models import Product
from app.schemas import ProductOut, ProductWrite
from app.services.presenters import presentar_producto
from app.storage import ObjectStorage, detectar_tipo_imagen, es_imagen_externa, obtener_storage

router = APIRouter(prefix="/api/admin", tags=["Administración"], dependencies=[Depends(requerir_admin)])

def obtener_producto_o_404(database: Session, product_id: int) -> Product:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese producto.")
    return product


@router.get("/products", response_model=List[ProductOut])
def listar_todos_los_productos(database: Session = Depends(obtener_sesion_db)):
    statement = select(Product).order_by(Product.id.desc())  # el admin ve tambien los ocultos
    return [presentar_producto(product) for product in database.scalars(statement)]


@router.get("/products/{product_id}", response_model=ProductOut)
def obtener_producto(product_id: int, database: Session = Depends(obtener_sesion_db)):
    return presentar_producto(obtener_producto_o_404(database, product_id))


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def crear_producto(request: ProductWrite, database: Session = Depends(obtener_sesion_db)):
    product = Product(**request.model_dump())
    database.add(product)
    database.commit()
    return presentar_producto(product)


@router.put("/products/{product_id}", response_model=ProductOut)
def actualizar_producto(product_id: int, request: ProductWrite, database: Session = Depends(obtener_sesion_db)):
    product = obtener_producto_o_404(database, product_id)
    for field_name, value in request.model_dump().items():
        setattr(product, field_name, value)
    database.commit()
    return presentar_producto(product)


@router.put("/products/{product_id}/image", response_model=ProductOut)
async def subir_imagen_producto(
    product_id: int,
    image: UploadFile,
    database: Session = Depends(obtener_sesion_db),
    storage: ObjectStorage = Depends(obtener_storage),
):
    product = obtener_producto_o_404(database, product_id)
    maximum_bytes = obtener_config().max_image_bytes

    content = await image.read(maximum_bytes + 1)  # leo uno de mas para saber si se pasa
    if len(content) > maximum_bytes:
        raise HTTPException(
            413,
            f"La imagen supera el máximo de {maximum_bytes // (1024 * 1024)} MB.",
        )
    detected_type = detectar_tipo_imagen(content)
    if detected_type is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Solo se aceptan imágenes JPG, PNG o WebP.")

    content_type, extension = detected_type
    new_key = f"products/{uuid4().hex}.{extension}"
    storage.guardar(new_key, content, content_type)

    # la anterior la borro recien despues de guardar la nueva
    previous_key = product.image_key
    product.image_key = new_key
    database.commit()
    if previous_key and not es_imagen_externa(previous_key):
        storage.borrar(previous_key)
    return presentar_producto(product)
