from tests.conftest import crear_producto


def test_catalogo_publico_oculta_inactivos(api):
    crear_producto("Visible")
    crear_producto("Oculto", is_active=False)
    names = [product["name"] for product in api.get("/api/products").json()]
    assert names == ["Visible"]


def test_detalle_de_producto_inactivo_da_404(api):
    hidden_id = crear_producto("Oculto", is_active=False)
    assert api.get(f"/api/products/{hidden_id}").status_code == 404


def test_busqueda_ignora_mayusculas_y_tildes(api):
    crear_producto("Pívot Pro")
    crear_producto("Base Veloz")
    assert [p["name"] for p in api.get("/api/products", params={"q": "PIVOT"}).json()] == ["Pívot Pro"]


def test_busqueda_no_interpreta_comodines(api):
    crear_producto("Base Veloz")
    assert api.get("/api/products", params={"q": "%"}).json() == []


def crear_producto_con_estilo(name, play_style, surface, price_cents=10000, stock=5, days_ago=0):
    from datetime import timedelta

    from app.database import SessionFactory
    from app.models import Product, ahora_utc

    with SessionFactory() as database:
        released_at = ahora_utc() - timedelta(days=days_ago)
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


def test_filtra_por_estilo_de_juego(api):
    crear_producto_con_estilo("Rápida", "SPEED", "INDOOR")
    crear_producto_con_estilo("Firme", "POWER", "INDOOR")
    names = [p["name"] for p in api.get("/api/products", params={"estilo": "POWER"}).json()]
    assert names == ["Firme"]


def test_ordena_por_novedad_y_precio(api):
    crear_producto_con_estilo("Vieja", "SPEED", "BOTH", price_cents=5000, days_ago=200)
    crear_producto_con_estilo("Nueva", "SPEED", "BOTH", price_cents=9000, days_ago=1)
    assert [p["name"] for p in api.get("/api/products").json()] == ["Nueva", "Vieja"]
    assert [p["name"] for p in api.get("/api/products", params={"orden": "precio-asc"}).json()] == ["Vieja", "Nueva"]
    assert [p["name"] for p in api.get("/api/products", params={"limite": 1}).json()] == ["Nueva"]


def test_solo_los_recientes_son_novedad(api):
    crear_producto_con_estilo("Vieja", "SPEED", "BOTH", days_ago=90)
    crear_producto_con_estilo("Nueva", "SPEED", "BOTH", days_ago=3)
    flags = {p["name"]: p["is_new"] for p in api.get("/api/products").json()}
    assert flags == {"Vieja": False, "Nueva": True}


def test_recomienda_por_estilo_y_prioriza_superficie(api):
    crear_producto_con_estilo("Pívot exterior", "POWER", "OUTDOOR", price_cents=12000)
    crear_producto_con_estilo("Pívot todo terreno", "POWER", "BOTH", price_cents=15000)
    crear_producto_con_estilo("Pívot parqué", "POWER", "INDOOR", price_cents=9000)
    crear_producto_con_estilo("Base exterior", "SPEED", "OUTDOOR")
    response = api.get("/api/products/recommendations", params={"estilo": "POWER", "superficie": "OUTDOOR"})
    assert response.status_code == 200
    ranked = [(item["product"]["name"], item["matches_surface"]) for item in response.json()]
    assert ranked == [("Pívot exterior", True), ("Pívot todo terreno", True), ("Pívot parqué", False)]


def test_no_recomienda_sin_stock(api):
    crear_producto_con_estilo("Agotada", "SPEED", "INDOOR", stock=0)
    response = api.get("/api/products/recommendations", params={"estilo": "SPEED", "superficie": "INDOOR"})
    assert response.json() == []


def test_recomendaciones_validan_parametros(api):
    response = api.get("/api/products/recommendations", params={"estilo": "DUNK", "superficie": "INDOOR"})
    assert response.status_code == 422
