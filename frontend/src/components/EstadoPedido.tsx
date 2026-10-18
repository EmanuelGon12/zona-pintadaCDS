import type { OrderStatus } from '../api/tipos'
import { ORDER_STATUS_LABELS } from '../lib/formato'

export function EstadoPedido({ status }: { status: OrderStatus }) {
  return <span className={`badge badge--${status.toLowerCase()}`}>{ORDER_STATUS_LABELS[status]}</span>;
}
