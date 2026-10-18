import { Link } from 'react-router-dom'
import { api } from '../../api/cliente'
import { EstadoError, Cargando } from '../../components/EstadosDePagina'
import { useCargarDatos } from '../../hooks/useCargarDatos'
import { formatearPrecio, pluralizar } from '../../lib/formato'
import { PLAY_STYLES } from '../../lib/estilosDeJuego'

export function PaginaAdminProductos() {
  const { data: products, error, isLoading } = useCargarDatos(() => api.listarProductosAdmin(), []);

  if (isLoading) return <Cargando />;
  if (error || !products) return <EstadoError error={error ?? new Error("No pudimos cargar los productos.")} />;

  return (
    <section className="wrapper page">
      <div className="section-heading">
        <div>
          <h1 className="display">Administración</h1>
          <p className="section-heading__lead">{pluralizar(products.length, "producto", "productos")}</p>
        </div>
        <Link className="button" to="/admin/productos/nuevo">
          Nuevo producto
        </Link>
      </div>
      <table className="data-table data-table--products">
        <thead>
          <tr>
            <th aria-label="Imagen" />
            <th>Modelo</th>
            <th className="numeric">Precio</th>
            <th className="numeric">Stock</th>
            <th>Estado</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td className="data-table__thumb">{product.image_url && <img src={product.image_url} alt="" />}</td>
              <td data-label="Modelo">
                <strong>{product.name}</strong>
                <br />
                <span className="muted">
                  {product.colorway} · {PLAY_STYLES[product.play_style].label}
                </span>
              </td>
              <td className="numeric" data-label="Precio">
                {formatearPrecio(product.price_cents)}
              </td>
              <td className="numeric" data-label="Stock">
                {product.stock}
              </td>
              <td data-label="Estado">
                <span className={`badge badge--${product.is_active ? "paid" : "cancelled"}`}>{product.is_active ? "Activo" : "Oculto"}</span>
              </td>
              <td>
                <Link className="text-link" to={`/admin/productos/${product.id}`}>
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
