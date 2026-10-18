import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Cart, CartLine } from "../api/types";
import { EmptyState, ErrorState, LoadingState } from "../components/PageStates";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { formatPrice, pluralize } from "../lib/format";

function useAbandonedCheckoutNotice() {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const showToast = useToast();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || searchParameters.get("pago") !== "cancelado") return;
    handledRef.current = true;
    const orderId = searchParameters.get("orden");
    setSearchParameters({}, { replace: true });
    if (orderId) api.abandonCheckout(orderId).catch(() => null);
    showToast("Cancelaste el pago. Tu carrito sigue como lo dejaste.");
  }, [searchParameters, setSearchParameters, showToast]);
}

function CartLineRow({ line, onChange }: { line: CartLine; onChange: (action: () => Promise<Cart>) => void }) {
  return (
    <li className={`cart-line${line.is_purchasable ? "" : " cart-line--problem"}`}>
      <Link className="cart-line__image" to={`/producto/${line.product.id}`}>
        {line.product.image_url && <img src={line.product.image_url} alt="" />}
      </Link>
      <div className="cart-line__info">
        <Link className="cart-line__name" to={`/producto/${line.product.id}`}>
          {line.product.name}
        </Link>
        <p className="cart-line__meta">
          {line.product.colorway} · Talla {line.size}
        </p>
        <p className="cart-line__meta">{formatPrice(line.unit_price_cents)}</p>
        {line.problem && <p className="cart-line__problem">{line.problem}</p>}
      </div>
      <div className="stepper" role="group" aria-label={`Cantidad de ${line.product.name}`}>
        <button
          type="button"
          aria-label="Quitar una unidad"
          disabled={line.quantity <= 1}
          onClick={() => onChange(() => api.changeCartQuantity(line.id, line.quantity - 1))}
        >
          −
        </button>
        <span className="stepper__value">{line.quantity}</span>
        <button type="button" aria-label="Agregar una unidad" onClick={() => onChange(() => api.changeCartQuantity(line.id, line.quantity + 1))}>
          +
        </button>
      </div>
      <p className="cart-line__total">{formatPrice(line.line_total_cents)}</p>
      <button className="text-button" type="button" onClick={() => onChange(() => api.removeFromCart(line.id))}>
        Quitar
      </button>
    </li>
  );
}

function OrderSummary({ cart }: { cart: Cart }) {
  const showToast = useToast();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const missingForFreeShipping = cart.free_shipping_threshold_cents - cart.subtotal_cents;

  async function goToPayment() {
    setIsRedirecting(true);
    try {
      const { checkout_url: checkoutUrl } = await api.startCheckout();
      if (checkoutUrl.startsWith("/")) {
        navigate(checkoutUrl);
      } else {
        window.location.assign(checkoutUrl);
      }
    } catch (error) {
      showToast((error as Error).message, "error");
      setIsRedirecting(false);
    }
  }

  return (
    <aside className="summary">
      <h2 className="summary__title">Resumen</h2>
      <dl>
        <div className="summary__row">
          <dt>Subtotal ({pluralize(cart.item_count, "par", "pares")})</dt>
          <dd>{formatPrice(cart.subtotal_cents)}</dd>
        </div>
        <div className="summary__row">
          <dt>Envío</dt>
          <dd>{cart.shipping_cents === 0 ? "Gratis" : formatPrice(cart.shipping_cents)}</dd>
        </div>
        <div className="summary__row summary__row--total">
          <dt>Total</dt>
          <dd>{formatPrice(cart.total_cents)}</dd>
        </div>
      </dl>
      {cart.shipping_cents > 0 && (
        <p className="summary__hint">Suma {formatPrice(missingForFreeShipping)} más y el envío es gratis.</p>
      )}
      <button className="button button--wide" type="button" onClick={goToPayment} disabled={!cart.can_checkout || isRedirecting}>
        {isRedirecting ? "Redirigiendo al pago…" : "Ir a pagar"}
      </button>
      {!cart.can_checkout && <p className="summary__hint">Resuelve los avisos de tu carrito para continuar.</p>}
    </aside>
  );
}

export function CartPage() {
  useAbandonedCheckoutNotice();
  const { setItemCount } = useCart();
  const showToast = useToast();
  const { data: cart, error, isLoading, setData } = useAsync(() => api.getCart(), []);

  useEffect(() => {
    if (cart) setItemCount(cart.item_count);
  }, [cart, setItemCount]);

  async function applyChange(action: () => Promise<Cart>) {
    try {
      setData(await action());
    } catch (changeError) {
      showToast((changeError as Error).message, "error");
    }
  }

  if (isLoading && !cart) return <LoadingState />;
  if (error || !cart) return <ErrorState error={error ?? new Error("No pudimos cargar tu carrito.")} />;

  return (
    <section className="wrapper page">
      <h1 className="display">Tu carrito</h1>
      {cart.lines.length === 0 ? (
        <EmptyState
          message="Todavía no agregaste nada."
          action={
            <Link className="button" to="/modelos">
              Ver los modelos
            </Link>
          }
        />
      ) : (
        <div className="cart-layout">
          <ul className="cart-lines">
            {cart.lines.map((line) => (
              <CartLineRow key={line.id} line={line} onChange={applyChange} />
            ))}
          </ul>
          <OrderSummary cart={cart} />
        </div>
      )}
    </section>
  );
}
