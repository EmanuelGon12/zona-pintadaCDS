from functools import lru_cache
from pathlib import Path
from typing import Optional, Protocol

from app.config import get_settings


def is_external_image(image_key: str) -> bool:
    return image_key.startswith(("http://", "https://"))


class ObjectStorage(Protocol):
    def save(self, key: str, content: bytes, content_type: str) -> None: ...

    def delete(self, key: str) -> None: ...

    def public_url(self, key: str) -> str: ...


class LocalDiskStorage:
    def __init__(self, root_directory: Path):
        self.root_directory = root_directory
        self.root_directory.mkdir(parents=True, exist_ok=True)

    def _path_for(self, key: str) -> Path:
        destination = (self.root_directory / key).resolve()
        if self.root_directory.resolve() not in destination.parents:
            raise ValueError("Clave de objeto inválida")
        return destination

    def save(self, key: str, content: bytes, content_type: str) -> None:
        destination = self._path_for(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

    def delete(self, key: str) -> None:
        self._path_for(key).unlink(missing_ok=True)

    def public_url(self, key: str) -> str:
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

    def save(self, key: str, content: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def public_url(self, key: str) -> str:
        if self.public_base_url:
            return f"{self.public_base_url}/{key}"
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=self.url_expiration_seconds,
        )


@lru_cache
def get_storage() -> ObjectStorage:
    settings = get_settings()
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
