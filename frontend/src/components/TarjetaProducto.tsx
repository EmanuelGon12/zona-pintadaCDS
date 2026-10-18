import { Link } from "react-router-dom";
import type { Product } from "../api/tipos";
import { formatearPrecio } from "../lib/formato";
import { PLAY_STYLES } from "../lib/estilosDeJuego";

function EtiquetaTarjeta({ product }: { product: Product }) {
  if (product.stock === 0) return <span className="card__badge card__badge--muted">Agotado</span>;
  if (product.is_new) return <span className="card__badge">Nuevo</span>;
  return null;
}

export function TarjetaProducto({ product, note }: { product: Product; note?: string }) {
  return (
    <Link className="card" to={`/producto/${product.id}`}>
      <div className="card__media">
        {product.image_url ? (
          <img src={product.image_url} alt={`${product.name}, ${product.colorway}`} loading="lazy" />
        ) : (
          <span className="card__placeholder">Sin imagen</span>
        )}
        <EtiquetaTarjeta product={product} />
      </div>
      <div className="card__body">
        <p className="card__style">{PLAY_STYLES[product.play_style].label}</p>
        <h3 className="card__name">{product.name}</h3>
        <p className="card__colorway">{product.colorway}</p>
        <p className="card__price">{formatearPrecio(product.price_cents)}</p>
        {note && <p className="card__note">{note}</p>}
      </div>
    </Link>
  );
}
