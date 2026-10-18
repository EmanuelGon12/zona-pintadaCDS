import type { OrderStatus } from "../api/tipos";

// pesos uruguayos con el formato de aca: $ 5.190
const pesosSinDecimales = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 });
const pesosConDecimales = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", minimumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("es-419", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-419", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatearPrecio(cents: number) {
  const formato = cents % 100 === 0 ? pesosSinDecimales : pesosConDecimales;
  return formato.format(cents / 100);
}
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

// acepta "5190", "5.190", "5190,50" o "5.190,50". Devuelve null si no es un precio valido
export function pesosACentavos(text: string): number | null {
  let normalized = text.trim().replace(/\s/g, "");
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}(\.|$)/.test(normalized)) {
    normalized = normalized.replace(/\./g, ""); // el punto era de miles
  }
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
