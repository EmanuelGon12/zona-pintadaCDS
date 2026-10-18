import { leerSesionGuardada } from "./sesionGuardada";
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
} from "./tipos";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;

// lo registra el contexto de sesion, asi el cliente no depende de react
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function alExpirarSesion(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
}

async function pedir<Result>(path: string, { method = "GET", body, form }: RequestOptions = {}): Promise<Result> {
  const headers: Record<string, string> = {};
  const token = leerSesionGuardada()?.access_token;
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

  // 401 con token = el token vencio, cerramos sesion
  if (response.status === 401 && token) {
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail; // fastapi manda el mensaje en "detail"
    throw new ApiError(typeof detail === "string" ? detail : "Ocurrió un error inesperado.", response.status);
  }
  return data as Result;
}

function parametrosCatalogo({ search, playStyle, order = "nuevos", limit }: CatalogQuery): string {
  const parameters = new URLSearchParams({ orden: order });
  if (search) parameters.set("q", search);
  if (playStyle) parameters.set("estilo", playStyle);
  if (limit) parameters.set("limite", String(limit));
  return parameters.toString();
}

export const api = {
  registrarse: (body: { full_name: string; email: string; password: string }) =>
    pedir<Session>("/auth/register", { method: "POST", body }),
  ingresar: (body: { email: string; password: string }) => pedir<Session>("/auth/login", { method: "POST", body }),
  usuarioActual: () => pedir<User>("/auth/me"),

  listarProductos: (query: CatalogQuery = {}) => pedir<Product[]>(`/products?${parametrosCatalogo(query)}`),
  obtenerProducto: (productId: number | string) => pedir<Product>(`/products/${productId}`),
  recomendarProductos: (playStyle: PlayStyle, surface: CourtSurface) =>
    pedir<Recommendation[]>(`/products/recommendations?${new URLSearchParams({ estilo: playStyle, superficie: surface })}`),

  obtenerCarrito: () => pedir<Cart>("/cart"),
  agregarAlCarrito: (productId: number, size: string, quantity: number) =>
    pedir<Cart>("/cart/items", { method: "POST", body: { product_id: productId, size, quantity } }),
  cambiarCantidad: (itemId: number, quantity: number) =>
    pedir<Cart>(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }),
  quitarDelCarrito: (itemId: number) => pedir<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }),

  iniciarPago: () => pedir<CheckoutSession>("/checkout/session", { method: "POST" }),
  confirmarPago: (orderId: number | string) => pedir<Order>(`/checkout/orders/${orderId}/confirm`, { method: "POST" }),
  abandonarPago: (orderId: number | string) => pedir<Order>(`/checkout/orders/${orderId}/cancel`, { method: "POST" }),
  pagarSimulado: (orderId: number, cardNumber: string) =>
    pedir<Order>(`/checkout/simulated/${orderId}/pay`, { method: "POST", body: { card_number: cardNumber } }),

  listarPedidos: () => pedir<Order[]>("/orders"),
  obtenerPedido: (orderId: number | string) => pedir<Order>(`/orders/${orderId}`),

  listarProductosAdmin: () => pedir<Product[]>("/admin/products"),
  obtenerProductoAdmin: (productId: number | string) => pedir<Product>(`/admin/products/${productId}`),
  crearProducto: (body: ProductInput) => pedir<Product>("/admin/products", { method: "POST", body }),
  actualizarProducto: (productId: number, body: ProductInput) =>
    pedir<Product>(`/admin/products/${productId}`, { method: "PUT", body }),
  subirImagen: (productId: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return pedir<Product>(`/admin/products/${productId}/image`, { method: "PUT", form });
  },
};
