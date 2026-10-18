import { readStoredSession } from "./sessionStorage";
import type {
  Cart,
  CatalogQuery,
  CheckoutSession,
  CourtSurface,
  Order,
  PlayStyle,
  Product,
  ProductInput,
  Recommendation,
  Session,
  User,
} from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function onUnauthorized(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
}

async function request<Result>(path: string, { method = "GET", body, form }: RequestOptions = {}): Promise<Result> {
  const headers: Record<string, string> = {};
  const token = readStoredSession()?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError("No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.", 0);
  }

  const data: unknown = await response.json().catch(() => null);

  if (response.status === 401 && token) {
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(typeof detail === "string" ? detail : "Ocurrió un error inesperado.", response.status);
  }
  return data as Result;
}

function catalogParameters({ search, playStyle, order = "nuevos", limit }: CatalogQuery): string {
  const parameters = new URLSearchParams({ orden: order });
  if (search) parameters.set("q", search);
  if (playStyle) parameters.set("estilo", playStyle);
  if (limit) parameters.set("limite", String(limit));
  return parameters.toString();
}

export const api = {
  register: (body: { full_name: string; email: string; password: string }) =>
    request<Session>("/auth/register", { method: "POST", body }),
  login: (body: { email: string; password: string }) => request<Session>("/auth/login", { method: "POST", body }),
  currentUser: () => request<User>("/auth/me"),

  listProducts: (query: CatalogQuery = {}) => request<Product[]>(`/products?${catalogParameters(query)}`),
  getProduct: (productId: number | string) => request<Product>(`/products/${productId}`),
  recommendProducts: (playStyle: PlayStyle, surface: CourtSurface) =>
    request<Recommendation[]>(`/products/recommendations?${new URLSearchParams({ estilo: playStyle, superficie: surface })}`),

  getCart: () => request<Cart>("/cart"),
  addToCart: (productId: number, size: string, quantity: number) =>
    request<Cart>("/cart/items", { method: "POST", body: { product_id: productId, size, quantity } }),
  changeCartQuantity: (itemId: number, quantity: number) =>
    request<Cart>(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }),
  removeFromCart: (itemId: number) => request<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }),

  startCheckout: () => request<CheckoutSession>("/checkout/session", { method: "POST" }),
  confirmPayment: (orderId: number | string) => request<Order>(`/checkout/orders/${orderId}/confirm`, { method: "POST" }),
  abandonCheckout: (orderId: number | string) => request<Order>(`/checkout/orders/${orderId}/cancel`, { method: "POST" }),
  paySimulated: (orderId: number, cardNumber: string) =>
    request<Order>(`/checkout/simulated/${orderId}/pay`, { method: "POST", body: { card_number: cardNumber } }),

  listOrders: () => request<Order[]>("/orders"),
  getOrder: (orderId: number | string) => request<Order>(`/orders/${orderId}`),

  adminListProducts: () => request<Product[]>("/admin/products"),
  adminGetProduct: (productId: number | string) => request<Product>(`/admin/products/${productId}`),
  adminCreateProduct: (body: ProductInput) => request<Product>("/admin/products", { method: "POST", body }),
  adminUpdateProduct: (productId: number, body: ProductInput) =>
    request<Product>(`/admin/products/${productId}`, { method: "PUT", body }),
  adminUploadImage: (productId: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<Product>(`/admin/products/${productId}/image`, { method: "PUT", form });
  },
};
