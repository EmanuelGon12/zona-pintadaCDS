from app.config import get_settings
from tests.conftest import PNG_BYTES, create_product

VALID_PRODUCT = {
    "name": "Nuevo Modelo",
    "colorway": "Rojo / Negro",
    "description": "Descripción",
    "price_cents": 11900,
    "stock": 10,
    "available_sizes": ["8", "9", " 9 ", "10"],
    "is_active": True,
}


def test_admin_creates_product_and_sizes_are_normalized(client, admin_headers):
    response = client.post("/api/admin/products", headers=admin_headers, json=VALID_PRODUCT)
    assert response.status_code == 201
    assert response.json()["available_sizes"] == ["8", "9", "10"]
    assert client.get("/api/products").json()[0]["name"] == "Nuevo Modelo"


def test_admin_sees_inactive_products_but_public_does_not(client, admin_headers):
    create_product("Oculto", is_active=False)
    assert len(client.get("/api/admin/products", headers=admin_headers).json()) == 1
    assert client.get("/api/products").json() == []


def test_product_validation_rejects_bad_price_and_stock(client, admin_headers):
    assert client.post("/api/admin/products", headers=admin_headers, json={**VALID_PRODUCT, "price_cents": 0}).status_code == 422
    assert client.post("/api/admin/products", headers=admin_headers, json={**VALID_PRODUCT, "stock": -1}).status_code == 422


def test_admin_edits_product(client, admin_headers):
    product_id = create_product()
    response = client.put(f"/api/admin/products/{product_id}", headers=admin_headers, json={**VALID_PRODUCT, "is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_customer_cannot_create_product(client, customer_headers):
    assert client.post("/api/admin/products", headers=customer_headers, json=VALID_PRODUCT).status_code == 403


def upload(client, headers, product_id, content, filename="foto.png", content_type="image/png"):
    return client.put(
        f"/api/admin/products/{product_id}/image",
        headers=headers,
        files={"image": (filename, content, content_type)},
    )


def test_valid_image_is_stored_and_referenced(client, admin_headers):
    product_id = create_product()
    response = upload(client, admin_headers, product_id, PNG_BYTES)
    assert response.status_code == 200
    image_url = response.json()["image_url"]
    assert image_url.startswith("/media/products/") and image_url.endswith(".png")
    assert client.get(image_url).status_code == 200


def test_replacing_image_removes_previous_file(client, admin_headers):
    product_id = create_product()
    first_url = upload(client, admin_headers, product_id, PNG_BYTES).json()["image_url"]
    second_url = upload(client, admin_headers, product_id, PNG_BYTES).json()["image_url"]
    assert first_url != second_url
    assert client.get(first_url).status_code == 404


def test_non_image_content_is_rejected_even_with_image_content_type(client, admin_headers):
    product_id = create_product()
    response = upload(client, admin_headers, product_id, b"<script>alert(1)</script>", "foto.png", "image/png")
    assert response.status_code == 415


def test_oversized_image_is_rejected(client, admin_headers):
    product_id = create_product()
    oversized = PNG_BYTES + b"\x00" * get_settings().max_image_bytes
    assert upload(client, admin_headers, product_id, oversized).status_code == 413
