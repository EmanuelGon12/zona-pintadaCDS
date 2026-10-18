import type { OrderStatus } from "../api/types";
import { ORDER_STATUS_LABELS } from "../lib/format";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge--${status.toLowerCase()}`}>{ORDER_STATUS_LABELS[status]}</span>;
}
