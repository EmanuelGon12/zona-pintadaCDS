export type Role = "CUSTOMER" | "ADMIN";
export type PlayStyle = "SPEED" | "ALL_AROUND" | "POWER";
export type CourtSurface = "INDOOR" | "OUTDOOR" | "BOTH";
export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";
export type CatalogOrder = "nuevos" | "precio-asc" | "precio-desc";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface Session {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  id: number;
  name: string;
  colorway: string;
  description: string;
  price_cents: number;
  stock: number;
  available_sizes: string[];
  image_url: string | null;
  play_style: PlayStyle;
  surface: CourtSurface;
  is_new: boolean;
  created_at: string;
  is_active: boolean;
}

export interface ProductInput {
  name: string;
  colorway: string;
  description: string;
  price_cents: number;
  stock: number;
  available_sizes: string[];
  play_style: PlayStyle;
  surface: CourtSurface;
  is_active: boolean;
}

export interface Recommendation {
  product: Product;
  matches_surface: boolean;
}

export interface CartLine {
  id: number;
  product: Product;
  size: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  is_purchasable: boolean;
  problem: string | null;
}

export interface Cart {
  lines: CartLine[];
  item_count: number;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  free_shipping_threshold_cents: number;
  can_checkout: boolean;
}

export interface OrderItem {
  product_id: number;
  product_name: string;
  image_url: string | null;
  size: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  created_at: string;
  paid_at: string | null;
  items: OrderItem[];
}

export interface CheckoutSession {
  order_id: number;
  checkout_url: string;
}

export interface CatalogQuery {
  search?: string;
  playStyle?: PlayStyle | "";
  order?: CatalogOrder;
  limit?: number;
}
