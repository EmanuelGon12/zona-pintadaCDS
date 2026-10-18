from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_database_session
from app.dependencies import require_admin
from app.models import Product
from app.schemas import ProductOut, ProductWrite
from app.services.presenters import present_product
from app.storage import ObjectStorage, get_storage, is_external_image

router = APIRouter(prefix="/api/admin", tags=["Administración"], dependencies=[Depends(require_admin)])

IMAGE_SIGNATURES = (
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
)


def detect_image_type(content: bytes):
    for signature, content_type, extension in IMAGE_SIGNATURES:
        if content.startswith(signature):
            return content_type, extension
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def get_product_or_404(database: Session, product_id: int) -> Product:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese producto.")
    return product


@router.get("/products", response_model=List[ProductOut])
def list_all_products(database: Session = Depends(get_database_session)):
    statement = select(Product).order_by(Product.id.desc())
    return [present_product(product) for product in database.scalars(statement)]


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, database: Session = Depends(get_database_session)):
    return present_product(get_product_or_404(database, product_id))


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(request: ProductWrite, database: Session = Depends(get_database_session)):
    product = Product(**request.model_dump())
    database.add(product)
    database.commit()
    return present_product(product)


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, request: ProductWrite, database: Session = Depends(get_database_session)):
    product = get_product_or_404(database, product_id)
    for field_name, value in request.model_dump().items():
        setattr(product, field_name, value)
    database.commit()
    return present_product(product)


@router.put("/products/{product_id}/image", response_model=ProductOut)
async def upload_product_image(
    product_id: int,
    image: UploadFile,
    database: Session = Depends(get_database_session),
    storage: ObjectStorage = Depends(get_storage),
):
    product = get_product_or_404(database, product_id)
    maximum_bytes = get_settings().max_image_bytes

    content = await image.read(maximum_bytes + 1)
    if len(content) > maximum_bytes:
        raise HTTPException(
            413,
            f"La imagen supera el máximo de {maximum_bytes // (1024 * 1024)} MB.",
        )
    detected_type = detect_image_type(content)
    if detected_type is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Solo se aceptan imágenes JPG, PNG o WebP.")

    content_type, extension = detected_type
    new_key = f"products/{uuid4().hex}.{extension}"
    storage.save(new_key, content, content_type)

    previous_key = product.image_key
    product.image_key = new_key
    database.commit()
    if previous_key and not is_external_image(previous_key):
        storage.delete(previous_key)
    return present_product(product)
