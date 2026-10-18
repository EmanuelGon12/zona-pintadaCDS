from app.config import obtener_config
from tests.conftest import PNG_BYTES, crear_producto

VALID_PRODUCT = {
    "name": "Nuevo Modelo",
    "colorway": "Rojo / Negro",
    "description": "Descripción",
    "price_cents": 11900,
    "stock": 10,
    "available_sizes": ["8", "9", " 9 ", "10"],
    "is_active": True,
}


def test_admin_crea_producto_y_limpia_tallas(api, headers_admin):
    response = api.post("/api/admin/products", headers=headers_admin, json=VALID_PRODUCT)
    assert response.status_code == 201
    assert response.json()["available_sizes"] == ["8", "9", "10"]
    assert api.get("/api/products").json()[0]["name"] == "Nuevo Modelo"


def test_admin_ve_productos_ocultos_y_el_publico_no(api, headers_admin):
    crear_producto("Oculto", is_active=False)
    assert len(api.get("/api/admin/products", headers=headers_admin).json()) == 1
    assert api.get("/api/products").json() == []


def test_rechaza_precio_y_stock_invalidos(api, headers_admin):
    assert api.post("/api/admin/products", headers=headers_admin, json={**VALID_PRODUCT, "price_cents": 0}).status_code == 422
    assert api.post("/api/admin/products", headers=headers_admin, json={**VALID_PRODUCT, "stock": -1}).status_code == 422


def test_admin_edita_producto(api, headers_admin):
    product_id = crear_producto()
    response = api.put(f"/api/admin/products/{product_id}", headers=headers_admin, json={**VALID_PRODUCT, "is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_cliente_no_puede_crear_productos(api, headers_cliente):
    assert api.post("/api/admin/products", headers=headers_cliente, json=VALID_PRODUCT).status_code == 403


def subir(api, headers, product_id, content, filename="foto.png", content_type="image/png"):
    return api.put(
        f"/api/admin/products/{product_id}/image",
        headers=headers,
        files={"image": (filename, content, content_type)},
    )


def test_imagen_valida_se_guarda_y_se_referencia(api, headers_admin):
    product_id = crear_producto()
    response = subir(api, headers_admin, product_id, PNG_BYTES)
    assert response.status_code == 200
    image_url = response.json()["image_url"]
    assert image_url.startswith("/media/products/") and image_url.endswith(".png")
    assert api.get(image_url).status_code == 200


def test_al_reemplazar_imagen_se_borra_la_anterior(api, headers_admin):
    product_id = crear_producto()
    first_url = subir(api, headers_admin, product_id, PNG_BYTES).json()["image_url"]
    second_url = subir(api, headers_admin, product_id, PNG_BYTES).json()["image_url"]
    assert first_url != second_url
    assert api.get(first_url).status_code == 404


def test_rechaza_archivo_que_no_es_imagen_aunque_diga_que_si(api, headers_admin):
    product_id = crear_producto()
    response = subir(api, headers_admin, product_id, b"<script>alert(1)</script>", "foto.png", "image/png")
    assert response.status_code == 415


def test_rechaza_imagen_muy_pesada(api, headers_admin):
    product_id = crear_producto()
    oversized = PNG_BYTES + b"\x00" * obtener_config().max_image_bytes
    assert subir(api, headers_admin, product_id, oversized).status_code == 413


def test_seed_sube_las_fotos_externas_al_storage(api):
    from app.database import SessionFactory
    from app.models import Product
    from app.seed import subir_fotos_externas
    from tests.conftest import crear_producto

    producto_id = crear_producto()
    with SessionFactory() as database:
        producto = database.get(Product, producto_id)
        producto.image_key = "https://images.unsplash.com/photo-123?fm=jpg"
        database.commit()

        descargas = []

        def descarga_falsa(url):
            descargas.append(url)
            return PNG_BYTES

        assert subir_fotos_externas(database, descargar=descarga_falsa) == 1
        # la segunda vez ya no queda nada para subir
        assert subir_fotos_externas(database, descargar=descarga_falsa) == 0
        assert len(descargas) == 1

    detalle = api.get(f"/api/products/{producto_id}").json()
    assert detalle["image_url"] == f"/media/products/seed-{producto_id}.png"
    assert api.get(detalle["image_url"]).status_code == 200


def test_seed_deja_la_url_si_la_descarga_falla(api):
    from app.database import SessionFactory
    from app.models import Product
    from app.seed import subir_fotos_externas
    from tests.conftest import crear_producto

    producto_id = crear_producto()
    with SessionFactory() as database:
        producto = database.get(Product, producto_id)
        producto.image_key = "https://images.unsplash.com/photo-roto"
        database.commit()

        def descarga_que_falla(url):
            raise OSError("sin conexión")

        assert subir_fotos_externas(database, descargar=descarga_que_falla) == 0
        assert database.get(Product, producto_id).image_key == "https://images.unsplash.com/photo-roto"
