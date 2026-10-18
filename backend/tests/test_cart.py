from tests.conftest import create_product


def add_to_cart(client, headers, product_id, size="9", quantity=1):
    return client.post("/api/cart/items", headers=headers, json={"product_id": product_id, "size": size, "quantity": quantity})


def test_totals_are_calculated_by_the_backend(client, customer_headers):
    product_id = create_product(price_cents=4000)
    cart = add_to_cart(client, customer_headers, product_id, quantity=2).json()
    assert cart["subtotal_cents"] == 8000
    assert cart["shipping_cents"] == 900
    assert cart["total_cents"] == 8900


def test_shipping_is_free_above_threshold(client, customer_headers):
    product_id = create_product(price_cents=16000)
    cart = add_to_cart(client, customer_headers, product_id).json()
    assert cart["shipping_cents"] == 0
    assert cart["total_cents"] == 16000


def test_adding_same_product_and_size_merges_lines(client, customer_headers):
    product_id = create_product()
    add_to_cart(client, customer_headers, product_id)
    cart = add_to_cart(client, customer_headers, product_id).json()
    assert len(cart["lines"]) == 1
    assert cart["lines"][0]["quantity"] == 2


def test_different_sizes_are_separate_lines(client, customer_headers):
    product_id = create_product()
    add_to_cart(client, customer_headers, product_id, size="8")
    cart = add_to_cart(client, customer_headers, product_id, size="10").json()
    assert len(cart["lines"]) == 2


def test_cannot_add_more_than_stock(client, customer_headers):
    product_id = create_product(stock=2)
    assert add_to_cart(client, customer_headers, product_id, quantity=3).status_code == 409


def test_cannot_add_unknown_size(client, customer_headers):
    product_id = create_product()
    assert add_to_cart(client, customer_headers, product_id, size="15").status_code == 422


def test_cannot_add_inactive_product(client, customer_headers):
    product_id = create_product(is_active=False)
    assert add_to_cart(client, customer_headers, product_id).status_code == 404


def test_update_and_remove_item(client, customer_headers):
    product_id = create_product(stock=5)
    line_id = add_to_cart(client, customer_headers, product_id).json()["lines"][0]["id"]

    updated = client.patch(f"/api/cart/items/{line_id}", headers=customer_headers, json={"quantity": 3}).json()
    assert updated["lines"][0]["quantity"] == 3

    emptied = client.delete(f"/api/cart/items/{line_id}", headers=customer_headers).json()
    assert emptied["lines"] == []


def test_cannot_touch_another_users_cart_line(client, customer_headers, other_customer_headers):
    product_id = create_product()
    line_id = add_to_cart(client, customer_headers, product_id).json()["lines"][0]["id"]
    assert client.delete(f"/api/cart/items/{line_id}", headers=other_customer_headers).status_code == 404
    assert client.patch(f"/api/cart/items/{line_id}", headers=other_customer_headers, json={"quantity": 2}).status_code == 404
