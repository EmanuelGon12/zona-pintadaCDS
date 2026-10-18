import type { OrderStatus } from "../api/types";

const priceFormatter = new Intl.NumberFormat("es-419", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-419", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-419", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatPrice = (cents: number) => priceFormatter.format(cents / 100);
export const formatDate = (isoDate: string) => dateFormatter.format(new Date(isoDate));
export const formatDateTime = (isoDate: string) => dateTimeFormatter.format(new Date(isoDate));
export const formatOrderNumber = (orderId: number) => `N.º ${String(orderId).padStart(5, "0")}`;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendiente de pago",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
};

export function dollarsToCents(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export const centsToDollarsText = (cents: number) => (cents / 100).toFixed(2);

export function formatCardNumber(rawValue: string): string {
  return rawValue
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export function formatCardExpiry(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

export const pluralize = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;
