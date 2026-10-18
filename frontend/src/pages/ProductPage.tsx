import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Product } from "../api/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CourtDiagram } from "../components/CourtDiagram";
import { ErrorState, LoadingState } from "../components/PageStates";
import { useCart } from "../context/CartContext";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { formatPrice } from "../lib/format";
import { PLAY_STYLES, SURFACES } from "../lib/playStyles";

const MAXIMUM_UNITS = 10;

function stockNote(product: Product): string | null {
  if (product.stock === 0) return "Sin stock por el momento.";
  if (product.stock <= 5) return `Quedan ${product.stock} pares.`;
  return null;
}

function PlayProfile({ product }: { product: Product }) {
  const style = PLAY_STYLES[product.play_style];
  const surface = SURFACES[product.surface];
  return (
    <div className="play-profile">
      <CourtDiagram playStyle={product.play_style} />
      <div>
        <p className="play-profile__title">
          {style.label} · {style.role}
        </p>
        <p className="play-profile__text">{style.summary}</p>
        <p className="play-profile__surface">
          Superficie: {surface.label.toLowerCase()} ({surface.detail.toLowerCase()})
        </p>
      </div>
    </div>
  );
}

function PurchaseForm({ product }: { product: Product }) {
  const { isAuthenticated } = useSession();
  const { setItemCount } = useCart();
  const showToast = useToast();
  const navigate = useNavigate();

  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const soldOut = product.stock === 0;
  const maximumQuantity = Math.min(MAXIMUM_UNITS, product.stock);
  const note = stockNote(product);

  async function addToCart(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!isAuthenticated) {
      navigate(`/ingresar?volver=${encodeURIComponent(`/producto/${product.id}`)}`);
      return;
    }
    if (!size) {
      setErrorMessage("Elige una talla para continuar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const cart = await api.addToCart(product.id, size, quantity);
      setItemCount(cart.item_count);
      showToast(`Agregaste talla ${size} al carrito.`);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="detail__form" onSubmit={addToCart} noValidate>
      <fieldset className="field-group">
        <legend className="field-label">Talla (US)</legend>
        <div className="size-grid">
          {product.available_sizes.map((availableSize) => (
            <label key={availableSize} className="size-option">
              <input
                type="radio"
                name="size"
                value={availableSize}
                checked={size === availableSize}
                onChange={() => setSize(availableSize)}
              />
              <span>{availableSize}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">Si estás entre dos tallas, te recomendamos la mayor.</p>
      </fieldset>

      {!soldOut && (
        <div className="field-group field-group--inline">
          <label className="field-label" htmlFor="quantity">
            Cantidad
          </label>
          <select
            id="quantity"
            className="select select--compact"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          >
            {Array.from({ length: maximumQuantity }, (_unused, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      {note && <p className="stock-note">{note}</p>}
      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
      <button className="button button--wide" type="submit" disabled={soldOut || isSubmitting}>
        {soldOut ? "Sin stock" : "Agregar al carrito"}
      </button>
    </form>
  );
}

export function ProductPage() {
  const { productId = "" } = useParams();
  const { data: product, error, isLoading } = useAsync(() => api.getProduct(productId), [productId]);

  if (isLoading) return <LoadingState />;
  if (error || !product) return <ErrorState error={error ?? new Error("No encontramos ese producto.")} />;

  return (
    <section className="wrapper page">
      <Breadcrumbs trail={[{ label: "Inicio", to: "/" }, { label: "Modelos", to: "/modelos" }, { label: product.name }]} />
      <div className="detail">
        <div className="detail__media">
          {product.image_url && <img src={product.image_url} alt={`${product.name}, ${product.colorway}`} />}
          {product.is_new && <span className="card__badge">Nuevo</span>}
        </div>
        <div className="detail__info">
          <h1 className="detail__title">{product.name}</h1>
          <p className="detail__colorway">{product.colorway}</p>
          <p className="detail__price">{formatPrice(product.price_cents)}</p>
          <PurchaseForm key={product.id} product={product} />
          <p className="detail__description">{product.description}</p>
          <PlayProfile product={product} />
          <dl className="detail__facts">
            <div>
              <dt>Envío</dt>
              <dd>Gratis desde USD 150. Llega en 24 a 72 h hábiles.</dd>
            </div>
            <div>
              <dt>Cambios</dt>
              <dd>Tienes 30 días para cambiar la talla.</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
