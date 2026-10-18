import enum
import unicodedata
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base


def fold_for_search(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(character for character in decomposed if not unicodedata.combining(character)).lower()


def current_utc_time() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    ADMIN = "ADMIN"


class PlayStyle(str, enum.Enum):
    SPEED = "SPEED"
    ALL_AROUND = "ALL_AROUND"
    POWER = "POWER"


class CourtSurface(str, enum.Enum):
    INDOOR = "INDOOR"
    OUTDOOR = "OUTDOOR"
    BOTH = "BOTH"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.CUSTOMER)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=current_utc_time)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    search_key: Mapped[str] = mapped_column(String(120), index=True, default="")
    colorway: Mapped[str] = mapped_column(String(80), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    price_cents: Mapped[int] = mapped_column(Integer)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    available_sizes: Mapped[List[str]] = mapped_column(JSON, default=list)
    image_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    play_style: Mapped[PlayStyle] = mapped_column(Enum(PlayStyle), default=PlayStyle.ALL_AROUND)
    surface: Mapped[CourtSurface] = mapped_column(Enum(CourtSurface), default=CourtSurface.BOTH)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=current_utc_time)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_utc_time, onupdate=current_utc_time
    )

    @validates("name")
    def keep_search_key_in_sync(self, _field_name: str, name: str) -> str:
        self.search_key = fold_for_search(name)
        return name


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id", "size", name="uq_cart_user_product_size"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    size: Mapped[str] = mapped_column(String(10))
    quantity: Mapped[int] = mapped_column(Integer)

    product: Mapped[Product] = relationship()


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING)
    subtotal_cents: Mapped[int] = mapped_column(Integer)
    shipping_cents: Mapped[int] = mapped_column(Integer)
    total_cents: Mapped[int] = mapped_column(Integer)
    payment_session_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=current_utc_time)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[List["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    product_name: Mapped[str] = mapped_column(String(120))
    image_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    size: Mapped[str] = mapped_column(String(10))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_cents: Mapped[int] = mapped_column(Integer)

    order: Mapped[Order] = relationship(back_populates="items")
