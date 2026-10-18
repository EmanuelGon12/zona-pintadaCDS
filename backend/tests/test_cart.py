from tests.conftest import crear_producto


def agregar_al_carrito(api, headers, product_id, size="9", quantity=1):
    return api.post("/api/cart/items", headers=headers, json={"product_id": product_id, "size": size, "quantity": quantity})


def test_los_totales_los_calcula_el_backend(api, headers_cliente):
    product_id = crear_producto(price_cents=4000)
    cart = agregar_al_carrito(api, headers_cliente, product_id, quantity=2).json()
    assert cart["subtotal_cents"] == 8000
    assert cart["shipping_cents"] == 900
    assert cart["total_cents"] == 8900


def test_envio_gratis_arriba_del_minimo(api, headers_cliente):
    product_id = crear_producto(price_cents=16000)
    cart = agregar_al_carrito(api, headers_cliente, product_id).json()
    assert cart["shipping_cents"] == 0
    assert cart["total_cents"] == 16000


def test_mismo_producto_y_talla_se_suman_en_una_linea(api, headers_cliente):
    product_id = crear_producto()
    agregar_al_carrito(api, headers_cliente, product_id)
    cart = agregar_al_carrito(api, headers_cliente, product_id).json()
    assert len(cart["lines"]) == 1
    assert cart["lines"][0]["quantity"] == 2


def test_tallas_distintas_van_en_lineas_separadas(api, headers_cliente):
    product_id = crear_producto()
    agregar_al_carrito(api, headers_cliente, product_id, size="8")
    cart = agregar_al_carrito(api, headers_cliente, product_id, size="10").json()
    assert len(cart["lines"]) == 2


def test_no_se_puede_agregar_mas_que_el_stock(api, headers_cliente):
    product_id = crear_producto(stock=2)
    assert agregar_al_carrito(api, headers_cliente, product_id, quantity=3).status_code == 409


def test_no_se_puede_agregar_talla_inexistente(api, headers_cliente):
    product_id = crear_producto()
    assert agregar_al_carrito(api, headers_cliente, product_id, size="15").status_code == 422


def test_no_se_puede_agregar_producto_inactivo(api, headers_cliente):
    product_id = crear_producto(is_active=False)
    assert agregar_al_carrito(api, headers_cliente, product_id).status_code == 404


def test_cambiar_cantidad_y_quitar(api, headers_cliente):
    product_id = crear_producto(stock=5)
    line_id = agregar_al_carrito(api, headers_cliente, product_id).json()["lines"][0]["id"]

    updated = api.patch(f"/api/cart/items/{line_id}", headers=headers_cliente, json={"quantity": 3}).json()
    assert updated["lines"][0]["quantity"] == 3

    emptied = api.delete(f"/api/cart/items/{line_id}", headers=headers_cliente).json()
    assert emptied["lines"] == []


def test_no_se_puede_tocar_el_carrito_de_otro(api, headers_cliente, headers_otro_cliente):
    product_id = crear_producto()
    line_id = agregar_al_carrito(api, headers_cliente, product_id).json()["lines"][0]["id"]
    assert api.delete(f"/api/cart/items/{line_id}", headers=headers_otro_cliente).status_code == 404
    assert api.patch(f"/api/cart/items/{line_id}", headers=headers_otro_cliente, json={"quantity": 2}).status_code == 404
