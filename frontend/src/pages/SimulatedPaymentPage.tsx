import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageStates";
import { useAsync } from "../hooks/useAsync";
import { formatCardExpiry, formatCardNumber, formatOrderNumber, formatPrice } from "../lib/format";

export function SimulatedPaymentPage() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const { data: order, error, isLoading } = useAsync(() => api.getOrder(orderId), [orderId]);

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !order) return <ErrorState error={error ?? new Error("No encontramos esa orden.")} />;
  if (order.status !== "PENDING") return <Navigate to={`/pedidos/${order.id}`} replace />;

  const payLabel = `Pagar ${formatPrice(order.total_cents)}`;

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    setErrorMessage(null);
    setIsPaying(true);
    try {
      await api.paySimulated(order.id, cardNumber);
      navigate(`/pedidos/${order.id}?pago=exitoso`);
    } catch (paymentError) {
      setErrorMessage((paymentError as Error).message);
      setIsPaying(false);
    }
  }

  return (
    <section className="wrapper page payment">
      <div className="payment__panel">
        <p className="kicker">Pasarela de prueba</p>
        <h1 className="display">Pagar con tarjeta</h1>
        <p className="payment__order">
          Pedido {formatOrderNumber(order.id)} · {formatPrice(order.total_cents)}
        </p>
        <form className="form" onSubmit={pay}>
          <div className="field-group">
            <label className="field-label" htmlFor="card_number">
              Número de tarjeta
            </label>
            <input
              id="card_number"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              required
              value={cardNumber}
              onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
            />
          </div>
          <div className="form-row">
            <div className="field-group">
              <label className="field-label" htmlFor="card_expiry">
                Vencimiento
              </label>
              <input
                id="card_expiry"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM / AA"
                value={expiry}
                onChange={(event) => setExpiry(formatCardExpiry(event.target.value))}
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="card_cvc">
                CVC
              </label>
              <input
                id="card_cvc"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="123"
                value={cvc}
                onChange={(event) => setCvc(event.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button className="button button--wide" type="submit" disabled={isPaying}>
            {isPaying ? "Procesando…" : payLabel}
          </button>
          <Link className="text-link payment__cancel" to={`/carrito?pago=cancelado&orden=${order.id}`}>
            Cancelar y volver al carrito
          </Link>
        </form>
        <div className="payment__test-cards">
          <p>
            <strong>Tarjetas de prueba</strong>
          </p>
          <p>4242 4242 4242 4242 · aprueba el pago</p>
          <p>4000 0000 0000 0002 · el banco la rechaza</p>
        </div>
      </div>
    </section>
  );
}
