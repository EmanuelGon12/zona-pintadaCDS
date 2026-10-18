import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/cliente";
import type { Cart, CartLine } from "../api/tipos";
import { EstadoVacio, EstadoError, Cargando } from "../components/EstadosDePagina";
import { useCarrito } from "../context/ContextoCarrito";
import { useAvisos } from "../context/ContextoAvisos";
import { useCargarDatos } from "../hooks/useCargarDatos";
import { formatearPrecio, pluralizar } from "../lib/formato";

function useAvisoPagoCancelado() {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const mostrarAviso = useAvisos();
  const handledRef = useRef(false); // en dev con StrictMode el efecto corre dos veces

  useEffect(() => {
    if (handledRef.current || searchParameters.get("pago") !== "cancelado") return;
    handledRef.current = true;
    const orderId = searchParameters.get("orden");
    setSearchParameters({}, { replace: true });
    if (orderId) api.abandonarPago(orderId).catch(() => null);
    mostrarAviso("Cancelaste el pago. Tu carrito sigue como lo dejaste.");
  }, [searchParameters, setSearchParameters, mostrarAviso]);
}

function FilaCarrito({ line, onChange }: { line: CartLine; onChange: (action: () => Promise<Cart>) => void }) {
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
        <p className="cart-line__meta">{formatearPrecio(line.unit_price_cents)}</p>
        {line.problem && <p className="cart-line__problem">{line.problem}</p>}
      </div>
      <div className="stepper" role="group" aria-label={`Cantidad de ${line.product.name}`}>
        <button
          type="button"
          aria-label="Quitar una unidad"
          disabled={line.quantity <= 1}
          onClick={() => onChange(() => api.cambiarCantidad(line.id, line.quantity - 1))}
        >
          −
        </button>
        <span className="stepper__value">{line.quantity}</span>
        <button type="button" aria-label="Agregar una unidad" onClick={() => onChange(() => api.cambiarCantidad(line.id, line.quantity + 1))}>
          +
        </button>
      </div>
      <p className="cart-line__total">{formatearPrecio(line.line_total_cents)}</p>
      <button className="text-button" type="button" onClick={() => onChange(() => api.quitarDelCarrito(line.id))}>
        Quitar
      </button>
    </li>
  );
}

function ResumenCompra({ cart }: { cart: Cart }) {
  const mostrarAviso = useAvisos();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const missingForFreeShipping = cart.free_shipping_threshold_cents - cart.subtotal_cents;

  async function irAPagar() {
    setIsRedirecting(true);
    try {
      const { checkout_url: checkoutUrl } = await api.iniciarPago();
      // el simulador devuelve una ruta nuestra, stripe una url externa
      if (checkoutUrl.startsWith("/")) {
        navigate(checkoutUrl);
      } else {
        window.location.assign(checkoutUrl);
      }
    } catch (error) {
      mostrarAviso((error as Error).message, "error");
      setIsRedirecting(false);
    }
  }

  return (
    <aside className="summary">
      <h2 className="summary__title">Resumen</h2>
      <dl>
        <div className="summary__row">
          <dt>Subtotal ({pluralizar(cart.item_count, "par", "pares")})</dt>
          <dd>{formatearPrecio(cart.subtotal_cents)}</dd>
        </div>
        <div className="summary__row">
          <dt>Envío</dt>
          <dd>{cart.shipping_cents === 0 ? "Gratis" : formatearPrecio(cart.shipping_cents)}</dd>
        </div>
        <div className="summary__row summary__row--total">
          <dt>Total</dt>
          <dd>{formatearPrecio(cart.total_cents)}</dd>
        </div>
      </dl>
      {cart.shipping_cents > 0 && (
        <p className="summary__hint">Suma {formatearPrecio(missingForFreeShipping)} más y el envío es gratis.</p>
      )}
      <button className="button button--wide" type="button" onClick={irAPagar} disabled={!cart.can_checkout || isRedirecting}>
        {isRedirecting ? "Redirigiendo al pago…" : "Ir a pagar"}
      </button>
      {!cart.can_checkout && <p className="summary__hint">Resuelve los avisos de tu carrito para continuar.</p>}
    </aside>
  );
}

export function PaginaCarrito() {
  useAvisoPagoCancelado();
  const { actualizarContador } = useCarrito();
  const mostrarAviso = useAvisos();
  const { data: cart, error, isLoading, cambiarDatos } = useCargarDatos(() => api.obtenerCarrito(), []);

  useEffect(() => {
    if (cart) actualizarContador(cart.item_count);
  }, [cart, actualizarContador]);

  async function aplicarCambio(action: () => Promise<Cart>) {
    try {
      cambiarDatos(await action());
    } catch (changeError) {
      mostrarAviso((changeError as Error).message, "error");
    }
  }

  if (isLoading && !cart) return <Cargando />;
  if (error || !cart) return <EstadoError error={error ?? new Error("No pudimos cargar tu carrito.")} />;

  return (
    <section className="wrapper page">
      <h1 className="display">Tu carrito</h1>
      {cart.lines.length === 0 ? (
        <EstadoVacio
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
              <FilaCarrito key={line.id} line={line} onChange={aplicarCambio} />
            ))}
          </ul>
          <ResumenCompra cart={cart} />
        </div>
      )}
    </section>
  );
}
