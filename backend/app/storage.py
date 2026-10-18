from functools import lru_cache
from pathlib import Path
from typing import Optional, Protocol

from app.config import obtener_config


# los primeros bytes de cada formato, asi no dependemos de lo que diga el navegador
FIRMAS_DE_IMAGEN = (
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
)


def detectar_tipo_imagen(content: bytes):
    for signature, content_type, extension in FIRMAS_DE_IMAGEN:
        if content.startswith(signature):
            return content_type, extension
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def es_imagen_externa(image_key: str) -> bool:
    return image_key.startswith(("http://", "https://"))


class ObjectStorage(Protocol):
    def guardar(self, key: str, content: bytes, content_type: str) -> None: ...

    def borrar(self, key: str) -> None: ...

    def url_publica(self, key: str) -> str: ...


class LocalDiskStorage:
    def __init__(self, root_directory: Path):
        self.root_directory = root_directory
        self.root_directory.mkdir(parents=True, exist_ok=True)

    def _ruta_de(self, key: str) -> Path:
        # por las dudas, que nadie pueda escribir fuera de la carpeta con un ../
        destination = (self.root_directory / key).resolve()
        if self.root_directory.resolve() not in destination.parents:
            raise ValueError("Clave de objeto inválida")
        return destination

    def guardar(self, key: str, content: bytes, content_type: str) -> None:
        destination = self._ruta_de(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

    def borrar(self, key: str) -> None:
        self._ruta_de(key).unlink(missing_ok=True)

    def url_publica(self, key: str) -> str:
        return f"/media/{key}"


class S3Storage:
    def __init__(self, bucket: str, region: str, endpoint_url: Optional[str], access_key_id: Optional[str],
                 secret_access_key: Optional[str], url_expiration_seconds: int, public_base_url: Optional[str]):
        import boto3

        self.bucket = bucket
        self.url_expiration_seconds = url_expiration_seconds
        self.public_base_url = public_base_url.rstrip("/") if public_base_url else None
        self.client = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )

    def guardar(self, key: str, content: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)

    def borrar(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def url_publica(self, key: str) -> str:
        # si el bucket es publico (supabase) armo la url directo, si no una firmada que vence
        if self.public_base_url:
            return f"{self.public_base_url}/{key}"
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=self.url_expiration_seconds,
        )


@lru_cache
def obtener_storage() -> ObjectStorage:
    settings = obtener_config()
    if settings.storage_backend == "s3":
        if not settings.s3_bucket:
            raise RuntimeError("STORAGE_BACKEND=s3 requiere S3_BUCKET")
        return S3Storage(
            bucket=settings.s3_bucket,
            region=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            url_expiration_seconds=settings.s3_url_expiration_seconds,
            public_base_url=settings.s3_public_base_url,
        )
    return LocalDiskStorage(settings.media_directory)
