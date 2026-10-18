from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
PROJECT_DIRECTORY = BACKEND_DIRECTORY.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIRECTORY / ".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIRECTORY / 'data' / 'zona_pintada.db'}"
    public_base_url: str = "http://localhost:8000"

    jwt_secret: str = "cambiar-esta-clave-en-produccion"
    jwt_expiration_minutes: int = 60 * 12

    admin_email: str = "admin@zonapintada.uy"
    admin_password: str = "admin12345"
    admin_full_name: str = "Admin"

    storage_backend: str = "local"
    media_directory: Path = BACKEND_DIRECTORY / "data" / "media"
    max_image_bytes: int = 3 * 1024 * 1024
    s3_bucket: Optional[str] = None
    s3_region: str = "us-east-1"
    s3_endpoint_url: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_url_expiration_seconds: int = 3600
    s3_public_base_url: Optional[str] = None

    mercadopago_access_token: Optional[str] = None
    mercadopago_webhook_secret: Optional[str] = None

    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    currency: str = "uyu"

    # montos en centavos de peso uruguayo: envio $290, gratis desde $6.000
    free_shipping_threshold_cents: int = 600000
    flat_shipping_cents: int = 29000
    max_units_per_line: int = 10

    frontend_directory: Path = PROJECT_DIRECTORY / "frontend" / "dist"

    @property
    def pasarela(self) -> str:
        # mercado pago tiene prioridad, despues stripe, y si no hay nada el simulador
        if self.mercadopago_access_token:
            return "mercadopago"
        if self.stripe_secret_key:
            return "stripe"
        return "simulada"


@lru_cache
def obtener_config() -> Settings:
    return Settings()
