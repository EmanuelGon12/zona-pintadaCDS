const priceFormatter = new Intl.NumberFormat("es-419", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("es-419", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-419", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatPrice = (cents) => priceFormatter.format(cents / 100);
export const formatDate = (isoDate) => dateFormatter.format(new Date(isoDate));
export const formatDateTime = (isoDate) => dateTimeFormatter.format(new Date(isoDate));
export const formatOrderNumber = (orderId) => `N.º ${String(orderId).padStart(5, "0")}`;

export const ORDER_STATUS_LABELS = {
  PENDING: "Pendiente de pago",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
};

export function dollarsToCents(text) {
  const normalized = String(text).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export const centsToDollarsText = (cents) => (cents / 100).toFixed(2);
