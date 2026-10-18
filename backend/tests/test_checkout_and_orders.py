from app.database import SessionFactory
from app.models import Product
from tests.conftest import create_product

APPROVED_CARD = "4242 4242 4242 4242"
DECLINED_CARD = "4000 0000 0000 0002"


def fill_cart(client, headers, product_id, quantity=2):
    client.post("/api/cart/items", headers=headers, json={"product_id": product_id, "size": "9", "quantity": quantity})


def start_checkout(client, headers):
    return client.post("/api/checkout/session", headers=headers)


def test_checkout_with_empty_cart_fails(client, customer_headers):
    assert start_checkout(client, customer_headers).status_code == 400


def test_checkout_creates_pending_order_with_price_snapshot(client, customer_headers):
    product_id = create_product(price_cents=5000)
    fill_cart(client, customer_headers, product_id)
    order_id = start_checkout(client, customer_headers).json()["order_id"]

    with SessionFactory() as database:
        database.get(Product, product_id).price_cents = 9900
        database.commit()

    order = client.get(f"/api/orders/{order_id}", headers=customer_headers).json()
    assert order["status"] == "PENDING"
    assert order["items"][0]["unit_price_cents"] == 5000
    assert order["subtotal_cents"] == 10000
    assert order["total_cents"] == 10900


def test_approved_payment_marks_order_paid_discounts_stock_and_clears_cart(client, customer_headers):
    product_id = create_product(price_cents=8000, stock=5)
    fill_cart(client, customer_headers, product_id, quantity=2)
    order_id = start_checkout(client, customer_headers).json()["order_id"]

    response = client.post(f"/api/checkout/simulated/{order_id}/pay", headers=customer_headers, json={"card_number": APPROVED_CARD})
    assert response.status_code == 200
    assert response.json()["status"] == "PAID"
    assert response.json()["paid_at"] is not None

    assert client.get("/api/cart", headers=customer_headers).json()["lines"] == []
    assert client.get(f"/api/products/{product_id}").json()["stock"] == 3


def test_declined_card_keeps_order_pending_and_cart_intact(client, customer_headers):
    product_id = create_product()
    fill_cart(client, customer_headers, product_id)
    order_id = start_checkout(client, customer_headers).json()["order_id"]

    response = client.post(f"/api/checkout/simulated/{order_id}/pay", headers=customer_headers, json={"card_number": DECLINED_CARD})
    assert response.status_code == 402
    assert client.get(f"/api/orders/{order_id}", headers=customer_headers).json()["status"] == "PENDING"
    assert len(client.get("/api/cart", headers=customer_headers).json()["lines"]) == 1


def test_paying_twice_is_rejected(client, customer_headers):
    product_id = create_product()
    fill_cart(client, customer_headers, product_id)
    order_id = start_checkout(client, customer_headers).json()["order_id"]
    payment = {"card_number": APPROVED_CARD}
    client.post(f"/api/checkout/simulated/{order_id}/pay", headers=customer_headers, json=payment)
    assert client.post(f"/api/checkout/simulated/{order_id}/pay", headers=customer_headers, json=payment).status_code == 409


def test_abandoned_checkout_cancels_order(client, customer_headers):
    product_id = create_product()
    fill_cart(client, customer_headers, product_id)
    order_id = start_checkout(client, customer_headers).json()["order_id"]
    cancelled = client.post(f"/api/checkout/orders/{order_id}/cancel", headers=customer_headers).json()
    assert cancelled["status"] == "CANCELLED"


def test_new_checkout_cancels_previous_pending_order(client, customer_headers):
    product_id = create_product()
    fill_cart(client, customer_headers, product_id)
    first_order_id = start_checkout(client, customer_headers).json()["order_id"]
    start_checkout(client, customer_headers)
    assert client.get(f"/api/orders/{first_order_id}", headers=customer_headers).json()["status"] == "CANCELLED"


def test_checkout_rejects_cart_that_exceeds_current_stock(client, customer_headers):
    product_id = create_product(stock=3)
    fill_cart(client, customer_headers, product_id, quantity=3)
    with SessionFactory() as database:
        database.get(Product, product_id).stock = 1
        database.commit()
    assert start_checkout(client, customer_headers).status_code == 409


def test_checkout_rejects_product_deactivated_after_adding(client, customer_headers):
    product_id = create_product()
    fill_cart(client, customer_headers, product_id)
    with SessionFactory() as database:
        database.get(Product, product_id).is_active = False
        database.commit()
    assert start_checkout(client, customer_headers).status_code == 409


def test_user_only_sees_their_own_orders(client, customer_headers, other_customer_headers):
    product_id = create_product()
    fill_cart(client, customer_headers, product_id)
    order_id = start_checkout(client, customer_headers).json()["order_id"]

    assert len(client.get("/api/orders", headers=customer_headers).json()) == 1
    assert client.get("/api/orders", headers=other_customer_headers).json() == []
    assert client.get(f"/api/orders/{order_id}", headers=other_customer_headers).status_code == 404
    assert client.post(f"/api/checkout/orders/{order_id}/cancel", headers=other_customer_headers).status_code == 404
    assert client.post(
        f"/api/checkout/simulated/{order_id}/pay", headers=other_customer_headers, json={"card_number": APPROVED_CARD}
    ).status_code == 404


def test_webhook_without_configuration_is_rejected(client):
    assert client.post("/api/checkout/webhook", content=b"{}").status_code == 400
