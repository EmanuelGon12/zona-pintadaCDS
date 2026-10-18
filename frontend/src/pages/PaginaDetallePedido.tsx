import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/cliente";
import type { Order } from "../api/tipos";
import { EstadoPedido } from "../components/EstadoPedido";
import { EstadoError, Cargando } from "../components/EstadosDePagina";
import { useCarrito } from "../context/ContextoCarrito";
import { formatearFechaHora, numeroDePedido, formatearPrecio } from "../lib/formato";

function AvisoPago({ order, cameFromPayment, onRetry }: { order: Order; cameFromPayment: boolean; onRetry: () => void }) {
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

export function PaginaDetallePedido() {
  const { orderId = "" } = useParams();
  const [searchParameters, setSearchParameters] = useSearchParams();
  const { refrescarContador } = useCarrito();
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

    // si viene de pagar le pido al backend que confirme con la pasarela, si no solo traigo la orden
    const load = cameFromPayment
      ? api.confirmarPago(orderId).then(async (confirmed) => {
          await refrescarContador();
          return confirmed;
        })
      : api.obtenerPedido(orderId);

    load.then(setOrder, setError);
  }, [orderId, verificationRound, cameFromPayment, searchParameters, setSearchParameters, refrescarContador]);

  if (error) return <EstadoError error={error} />;
  if (!order) return <Cargando />;

  return (
    <section className="wrapper page order">
      <Link className="text-link back-link" to="/pedidos">
        ← Mis pedidos
      </Link>
      <div className="order__heading">
        <h1 className="display">Pedido {numeroDePedido(order.id)}</h1>
        <EstadoPedido status={order.status} />
      </div>
      <AvisoPago order={order} cameFromPayment={cameFromPayment} onRetry={() => setVerificationRound((round) => round + 1)} />
      <p className="order__date">
        Realizado el {formatearFechaHora(order.created_at)}
        {order.paid_at && ` · Pagado el ${formatearFechaHora(order.paid_at)}`}
      </p>
      <ul className="order-lines">
        {order.items.map((item) => (
          <li key={`${item.product_id}-${item.size}`} className="order-line">
            <div className="order-line__image">{item.image_url && <img src={item.image_url} alt="" />}</div>
            <div className="order-line__info">
              <p className="order-line__name">{item.product_name}</p>
              <p className="order-line__meta">
                Talla {item.size} · {item.quantity} × {formatearPrecio(item.unit_price_cents)}
              </p>
            </div>
            <p className="order-line__total">{formatearPrecio(item.line_total_cents)}</p>
          </li>
        ))}
      </ul>
      <dl className="order-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatearPrecio(order.subtotal_cents)}</dd>
        </div>
        <div>
          <dt>Envío</dt>
          <dd>{order.shipping_cents === 0 ? "Gratis" : formatearPrecio(order.shipping_cents)}</dd>
        </div>
        <div className="order-totals__final">
          <dt>Total</dt>
          <dd>{formatearPrecio(order.total_cents)}</dd>
        </div>
      </dl>
    </section>
  );
}
