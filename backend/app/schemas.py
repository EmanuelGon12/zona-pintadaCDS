from datetime import datetime
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.models import CourtSurface, OrderStatus, PlayStyle, Role


# el strip va antes de medir el largo, si no "   " pasaba como nombre valido
NombreLimpio = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]


class RegistrationRequest(BaseModel):
    email: EmailStr
    full_name: NombreLimpio
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_entra_en_bcrypt(cls, value: str) -> str:
        # bcrypt corta en 72 bytes y la version nueva tira error. Con tildes o ñ 72 caracteres son mas bytes
        if len(value.encode("utf-8")) > 72:
            raise ValueError("es demasiado larga")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: Role


class SessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProductWrite(BaseModel):
    name: NombreLimpio
    colorway: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    price_cents: int = Field(gt=0, le=100_000_000)
    stock: int = Field(ge=0, le=100_000)
    available_sizes: List[str] = Field(min_length=1, max_length=30)
    play_style: PlayStyle = PlayStyle.ALL_AROUND
    surface: CourtSurface = CourtSurface.BOTH
    is_active: bool = True

    @field_validator("available_sizes")
    @classmethod
    def normalizar_tallas(cls, sizes: List[str]) -> List[str]:
        cleaned = list(dict.fromkeys(size.strip() for size in sizes if size.strip()))
        if not cleaned:
            raise ValueError("Indica al menos una talla")
        if any(len(size) > 10 for size in cleaned):
            raise ValueError("Talla demasiado larga")
        return cleaned


class ProductOut(BaseModel):
    id: int
    name: str
    colorway: str
    description: str
    price_cents: int
    stock: int
    available_sizes: List[str]
    image_url: Optional[str]
    play_style: PlayStyle
    surface: CourtSurface
    is_new: bool
    created_at: datetime
    is_active: bool


class RecommendationOut(BaseModel):
    product: ProductOut
    matches_surface: bool


class CartItemCreate(BaseModel):
    product_id: int
    size: str = Field(min_length=1, max_length=10)
    quantity: int = Field(default=1, ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)


class CartLineOut(BaseModel):
    id: int
    product: ProductOut
    size: str
    quantity: int
    unit_price_cents: int
    line_total_cents: int
    is_purchasable: bool
    problem: Optional[str]


class CartOut(BaseModel):
    lines: List[CartLineOut]
    item_count: int
    subtotal_cents: int
    shipping_cents: int
    total_cents: int
    free_shipping_threshold_cents: int
    can_checkout: bool


class OrderItemOut(BaseModel):
    product_id: int
    product_name: str
    image_url: Optional[str]
    size: str
    quantity: int
    unit_price_cents: int
    line_total_cents: int


class OrderOut(BaseModel):
    id: int
    status: OrderStatus
    subtotal_cents: int
    shipping_cents: int
    total_cents: int
    created_at: datetime
    paid_at: Optional[datetime]
    items: List[OrderItemOut]


class CheckoutOut(BaseModel):
    order_id: int
    checkout_url: str


class SimulatedPaymentRequest(BaseModel):
    card_number: str = Field(min_length=12, max_length=23)
