import type { OrderStatus } from "../api/tipos";

const priceFormatter = new Intl.NumberFormat("es-419", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-419", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-419", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatearPrecio = (cents: number) => priceFormatter.format(cents / 100);
export const formatearFecha = (isoDate: string) => dateFormatter.format(new Date(isoDate));
export const formatearFechaHora = (isoDate: string) => dateTimeFormatter.format(new Date(isoDate));
export function numeroDePedido(orderId: number) {
  return "N.º " + String(orderId).padStart(5, "0");
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendiente de pago",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
};

// acepta "129.90" o "129,9". Devuelve null si no es un precio valido
export function dolaresACentavos(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export const centavosATexto = (cents: number) => (cents / 100).toFixed(2);

export function formatearTarjeta(rawValue: string): string {
  return rawValue.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

export function formatearVencimiento(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

export const pluralizar = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;
