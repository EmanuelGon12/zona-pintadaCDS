import { clearSession, getToken } from "./session.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError("No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.", 0);
  }

  const data = await response.json().catch(() => null);

  if (response.status === 401 && token) {
    clearSession();
    window.location.hash = "#/ingresar";
  }
  if (!response.ok) {
    throw new ApiError(data?.detail || "Ocurrió un error inesperado.", response.status);
  }
  return data;
}

export const api = {
  register: (body) => request("/auth/register", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),

  listProducts: ({ search = "", playStyle = "", order = "nuevos", limit } = {}) => {
    const parameters = new URLSearchParams({ orden: order });
    if (search) parameters.set("q", search);
    if (playStyle) parameters.set("estilo", playStyle);
    if (limit) parameters.set("limite", String(limit));
    return request(`/products?${parameters}`);
  },
  recommendProducts: (playStyle, surface) =>
    request(`/products/recommendations?${new URLSearchParams({ estilo: playStyle, superficie: surface })}`),
  getProduct: (productId) => request(`/products/${productId}`),

  getCart: () => request("/cart"),
  addToCart: (productId, size, quantity) =>
    request("/cart/items", { method: "POST", body: { product_id: productId, size, quantity } }),
  changeCartQuantity: (itemId, quantity) =>
    request(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }),
  removeFromCart: (itemId) => request(`/cart/items/${itemId}`, { method: "DELETE" }),

  startCheckout: () => request("/checkout/session", { method: "POST" }),
  confirmPayment: (orderId) => request(`/checkout/orders/${orderId}/confirm`, { method: "POST" }),
  abandonCheckout: (orderId) => request(`/checkout/orders/${orderId}/cancel`, { method: "POST" }),
  paySimulated: (orderId, cardNumber) =>
    request(`/checkout/simulated/${orderId}/pay`, { method: "POST", body: { card_number: cardNumber } }),

  listOrders: () => request("/orders"),
  getOrder: (orderId) => request(`/orders/${orderId}`),

  adminListProducts: () => request("/admin/products"),
  adminGetProduct: (productId) => request(`/admin/products/${productId}`),
  adminCreateProduct: (body) => request("/admin/products", { method: "POST", body }),
  adminUpdateProduct: (productId, body) => request(`/admin/products/${productId}`, { method: "PUT", body }),
  adminUploadImage: (productId, file) => {
    const form = new FormData();
    form.append("image", file);
    return request(`/admin/products/${productId}/image`, { method: "PUT", form });
  },
};
