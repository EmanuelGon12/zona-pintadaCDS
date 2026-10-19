

from app.database import SessionFactory
from app.models import Product, User
from app.storage import S3Storage


class ClienteS3Falso:
    def __init__(self):
        self.objetos = {}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objetos[(Bucket, Key)] = (Body, ContentType)

    def delete_object(self, Bucket, Key):
        self.objetos.pop((Bucket, Key), None)

    def generate_presigned_url(self, operacion, Params, ExpiresIn):
        return f"https://firmada/{Params['Bucket']}/{Params['Key']}?vence={ExpiresIn}"


def storage_s3(monkeypatch, url_publica=None):
    import boto3

    cliente = ClienteS3Falso()
    monkeypatch.setattr(boto3, "client", lambda *_a, **_k: cliente)
    storage = S3Storage("product-images", "ca-central-1", "https://s3.test", "clave", "secreto", 3600, url_publica)
    return storage, cliente


def test_s3_guarda_y_borra_objetos(monkeypatch):
    storage, cliente = storage_s3(monkeypatch)
    storage.guardar("products/a.jpg", b"jpg", "image/jpeg")
    assert cliente.objetos[("product-images", "products/a.jpg")] == (b"jpg", "image/jpeg")
    storage.borrar("products/a.jpg")
    assert cliente.objetos == {}


def test_s3_con_bucket_publico_arma_la_url_directa(monkeypatch):
    storage, _ = storage_s3(monkeypatch, "https://ref.supabase.co/storage/v1/object/public/product-images/")
    assert storage.url_publica("products/a.jpg") == "https://ref.supabase.co/storage/v1/object/public/product-images/products/a.jpg"


def test_s3_con_bucket_privado_usa_url_firmada(monkeypatch):
    storage, _ = storage_s3(monkeypatch)
    assert storage.url_publica("products/a.jpg") == "https://firmada/product-images/products/a.jpg?vence=3600"


def test_el_seed_se_puede_correr_varias_veces(monkeypatch):
    from app import seed

    monkeypatch.setattr(seed, "descargar_imagen", lambda url: b"\xff\xd8\xff" + b"0" * 32)
    seed.ejecutar()
    seed.ejecutar()

    with SessionFactory() as database:
        assert database.query(User).filter_by(role="ADMIN").count() == 1
        assert database.query(Product).count() == len(seed.CATALOG)
        assert all(not producto.image_key.startswith("http") for producto in database.query(Product))
