import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Order } from "../api/types";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { ErrorState, LoadingState } from "../components/PageStates";
import { useCart } from "../context/CartContext";
import { formatDateTime, formatOrderNumber, formatPrice } from "../lib/format";

function PaymentBanner({ order, cameFromPayment, onRetry }: { order: Order; cameFromPayment: boolean; onRetry: () => void }) {
  if (order.status === "PAID" && cameFromPayment) {
    return (
      <div className="banner banner--ok">
        <strong>Pago aprobado.</strong> Ya estamos preparando tu pedido.
      </div>
    );
  }
  if (order.status === "PENDING" && cameFromPayment) {
    return (
      <div className="banner banner--warn">
        <strong>Estamos confirmando tu pago.</strong> Puede tardar unos segundos.{" "}
        <button className="text-button" type="button" onClick={onRetry}>
          Volver a verificar
        </button>
      </div>
    );
  }
  if (order.status === "CANCELLED") {
    return <div className="banner banner--error">Este pedido fue cancelado y no se realizó ningún cobro.</div>;
  }
  return null;
}

export function OrderDetailPage() {
  const { orderId = "" } = useParams();
  const [searchParameters, setSearchParameters] = useSearchParams();
  const { refreshItemCount } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [cameFromPayment] = useState(() => searchParameters.get("pago") === "exitoso");
  const [verificationRound, setVerificationRound] = useState(0);
  const loadedRoundRef = useRef<string | null>(null);

  useEffect(() => {
    const roundKey = `${orderId}:${verificationRound}`;
    if (loadedRoundRef.current === roundKey) return;
    loadedRoundRef.current = roundKey;

    if (searchParameters.has("pago")) setSearchParameters({}, { replace: true });

    const load = cameFromPayment
      ? api.confirmPayment(orderId).then(async (confirmed) => {
          await refreshItemCount();
          return confirmed;
        })
      : api.getOrder(orderId);

    load.then(setOrder, setError);
  }, [orderId, verificationRound, cameFromPayment, searchParameters, setSearchParameters, refreshItemCount]);

  if (error) return <ErrorState error={error} />;
  if (!order) return <LoadingState />;

  return (
    <section className="wrapper page order">
      <Link className="text-link back-link" to="/pedidos">
        ← Mis pedidos
      </Link>
      <div className="order__heading">
        <h1 className="display">Pedido {formatOrderNumber(order.id)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <PaymentBanner order={order} cameFromPayment={cameFromPayment} onRetry={() => setVerificationRound((round) => round + 1)} />
      <p className="order__date">
        Realizado el {formatDateTime(order.created_at)}
        {order.paid_at && ` · Pagado el ${formatDateTime(order.paid_at)}`}
      </p>
      <ul className="order-lines">
        {order.items.map((item) => (
          <li key={`${item.product_id}-${item.size}`} className="order-line">
            <div className="order-line__image">{item.image_url && <img src={item.image_url} alt="" />}</div>
            <div className="order-line__info">
              <p className="order-line__name">{item.product_name}</p>
              <p className="order-line__meta">
                Talla {item.size} · {item.quantity} × {formatPrice(item.unit_price_cents)}
              </p>
            </div>
            <p className="order-line__total">{formatPrice(item.line_total_cents)}</p>
          </li>
        ))}
      </ul>
      <dl className="order-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatPrice(order.subtotal_cents)}</dd>
        </div>
        <div>
          <dt>Envío</dt>
          <dd>{order.shipping_cents === 0 ? "Gratis" : formatPrice(order.shipping_cents)}</dd>
        </div>
        <div className="order-totals__final">
          <dt>Total</dt>
          <dd>{formatPrice(order.total_cents)}</dd>
        </div>
      </dl>
    </section>
  );
}
