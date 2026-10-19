import type { Cart, Order, Product } from "../api/tipos";

export function productoDePrueba(cambios: Partial<Product> = {}): Product {
  return {
    id: 2,
    name: "Zapatilla de básquetbol corte medio blanca y roja",
    colorway: "Blanco / Rojo",
    description: "Corte medio",
    price_cents: 519000,
    stock: 10,
    available_sizes: ["8", "9", "10"],
    image_url: null,
    play_style: "ALL_AROUND",
    surface: "BOTH",
    is_new: false,
    created_at: "2026-10-01T00:00:00Z",
    is_active: true,
    ...cambios,
  };
}

export function carritoDePrueba(cambios: Partial<Cart> = {}): Cart {
  const producto = productoDePrueba();
  return {
    lines: [
      {
        id: 11,
        product: producto,
        size: "9",
        quantity: 1,
        unit_price_cents: producto.price_cents,
        line_total_cents: producto.price_cents,
        is_purchasable: true,
        problem: null,
      },
    ],
    item_count: 1,
    subtotal_cents: 519000,
    shipping_cents: 29000,
    total_cents: 548000,
    free_shipping_threshold_cents: 600000,
    can_checkout: true,
    ...cambios,
  };
}

export function pedidoDePrueba(cambios: Partial<Order> = {}): Order {
  return {
    id: 12,
    status: "PENDING",
    subtotal_cents: 519000,
    shipping_cents: 29000,
    total_cents: 548000,
    created_at: "2026-10-18T15:00:00Z",
    paid_at: null,
    items: [
      { product_id: 2, product_name: "Zapatilla blanca y roja", image_url: null, size: "9", quantity: 1, unit_price_cents: 519000, line_total_cents: 519000 },
    ],
    ...cambios,
  };
}
