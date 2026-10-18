from tests.conftest import create_product


def test_public_catalog_hides_inactive_products(client):
    create_product("Visible")
    create_product("Oculto", is_active=False)
    names = [product["name"] for product in client.get("/api/products").json()]
    assert names == ["Visible"]


def test_inactive_product_detail_is_not_found(client):
    hidden_id = create_product("Oculto", is_active=False)
    assert client.get(f"/api/products/{hidden_id}").status_code == 404


def test_search_ignores_case_and_accents(client):
    create_product("Pívot Pro")
    create_product("Base Veloz")
    assert [p["name"] for p in client.get("/api/products", params={"q": "PIVOT"}).json()] == ["Pívot Pro"]


def test_search_treats_wildcards_literally(client):
    create_product("Base Veloz")
    assert client.get("/api/products", params={"q": "%"}).json() == []


def create_styled_product(name, play_style, surface, price_cents=10000, stock=5, days_ago=0):
    from datetime import timedelta

    from app.database import SessionFactory
    from app.models import Product, current_utc_time

    with SessionFactory() as database:
        released_at = current_utc_time() - timedelta(days=days_ago)
        product = Product(
            name=name,
            colorway="Negro",
            description="",
            price_cents=price_cents,
            stock=stock,
            available_sizes=["9"],
            play_style=play_style,
            surface=surface,
            created_at=released_at,
        )
        database.add(product)
        database.commit()
        return product.id


def test_catalog_filters_by_play_style(client):
    create_styled_product("Rápida", "SPEED", "INDOOR")
    create_styled_product("Firme", "POWER", "INDOOR")
    names = [p["name"] for p in client.get("/api/products", params={"estilo": "POWER"}).json()]
    assert names == ["Firme"]


def test_catalog_orders_by_newest_and_price(client):
    create_styled_product("Vieja", "SPEED", "BOTH", price_cents=5000, days_ago=200)
    create_styled_product("Nueva", "SPEED", "BOTH", price_cents=9000, days_ago=1)
    assert [p["name"] for p in client.get("/api/products").json()] == ["Nueva", "Vieja"]
    assert [p["name"] for p in client.get("/api/products", params={"orden": "precio-asc"}).json()] == ["Vieja", "Nueva"]
    assert [p["name"] for p in client.get("/api/products", params={"limite": 1}).json()] == ["Nueva"]


def test_only_recent_products_are_flagged_as_new(client):
    create_styled_product("Vieja", "SPEED", "BOTH", days_ago=90)
    create_styled_product("Nueva", "SPEED", "BOTH", days_ago=3)
    flags = {p["name"]: p["is_new"] for p in client.get("/api/products").json()}
    assert flags == {"Vieja": False, "Nueva": True}


def test_recommendations_match_style_and_prefer_surface(client):
    create_styled_product("Pívot exterior", "POWER", "OUTDOOR", price_cents=12000)
    create_styled_product("Pívot todo terreno", "POWER", "BOTH", price_cents=15000)
    create_styled_product("Pívot parqué", "POWER", "INDOOR", price_cents=9000)
    create_styled_product("Base exterior", "SPEED", "OUTDOOR")
    response = client.get("/api/products/recommendations", params={"estilo": "POWER", "superficie": "OUTDOOR"})
    assert response.status_code == 200
    ranked = [(item["product"]["name"], item["matches_surface"]) for item in response.json()]
    assert ranked == [("Pívot exterior", True), ("Pívot todo terreno", True), ("Pívot parqué", False)]


def test_recommendations_skip_products_without_stock(client):
    create_styled_product("Agotada", "SPEED", "INDOOR", stock=0)
    response = client.get("/api/products/recommendations", params={"estilo": "SPEED", "superficie": "INDOOR"})
    assert response.json() == []


def test_recommendations_require_valid_options(client):
    response = client.get("/api/products/recommendations", params={"estilo": "DUNK", "superficie": "INDOOR"})
    assert response.status_code == 422
