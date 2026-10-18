import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/cliente";
import type { CatalogOrder } from "../api/tipos";
import { MigasDePan } from "../components/MigasDePan";
import { EstadoVacio, EstadoError, Cargando } from "../components/EstadosDePagina";
import { TarjetaProducto } from "../components/TarjetaProducto";
import { useCargarDatos } from "../hooks/useCargarDatos";
import { rutaCatalogo } from "../lib/rutaCatalogo";
import { pluralizar } from "../lib/formato";
import { PLAY_STYLES, PLAY_STYLE_KEYS, esEstiloDeJuego } from "../lib/estilosDeJuego";

const ORDER_OPTIONS: Record<CatalogOrder, string> = {
  nuevos: "Más nuevos",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
};

function esOrdenValido(value: string | null): value is CatalogOrder {
  return value !== null && value in ORDER_OPTIONS;
}

export function PaginaCatalogo() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();

  const search = (searchParameters.get("q") ?? "").trim();
  const requestedStyle = searchParameters.get("estilo");
  const playStyle = esEstiloDeJuego(requestedStyle) ? requestedStyle : "";
  const requestedOrder = searchParameters.get("orden");
  const order: CatalogOrder = esOrdenValido(requestedOrder) ? requestedOrder : "nuevos";

  const { data: products, error, isLoading } = useCargarDatos(
    () => api.listarProductos({ search, playStyle, order }),
    [search, playStyle, order]
  );

  let title = "Todos los modelos";
  if (playStyle) title = `Modelos de ${PLAY_STYLES[playStyle].label.toLowerCase()}`;
  if (search) title = `Resultados para “${search}”`;

  return (
    <section className="wrapper page">
      <MigasDePan trail={[{ label: "Inicio", to: "/" }, { label: "Modelos" }]} />
      <div className="catalog-heading">
        <h1 className="display">{title}</h1>
        {products && <span className="muted">{pluralizar(products.length, "modelo", "modelos")}</span>}
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filtrar por estilo de juego">
          <Link className="chip" to={rutaCatalogo({ search, order })} aria-current={!playStyle ? "true" : undefined}>
            Todos
          </Link>
          {PLAY_STYLE_KEYS.map((key) => (
            <Link
              key={key}
              className="chip"
              to={rutaCatalogo({ search, playStyle: key, order })}
              aria-current={playStyle === key ? "true" : undefined}
            >
              {PLAY_STYLES[key].label}
            </Link>
          ))}
        </div>
        <div className="toolbar__sort">
          <label htmlFor="catalog-order">Ordenar por</label>
          <select
            id="catalog-order"
            className="select select--compact"
            value={order}
            onChange={(event) => navigate(rutaCatalogo({ search, playStyle, order: event.target.value as CatalogOrder }))}
          >
            {Object.entries(ORDER_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {search && (
        <p className="search-note">
          <Link className="text-link" to={rutaCatalogo({ playStyle, order })}>
            Quitar búsqueda
          </Link>
        </p>
      )}

      {isLoading && !products && <Cargando />}
      {error && <EstadoError error={error} />}
      {products &&
        (products.length ? (
          <div className="card-grid">
            {products.map((product) => (
              <TarjetaProducto key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EstadoVacio
            message="No encontramos modelos con esos filtros."
            action={
              <Link className="button" to="/modelos">
                Ver todos los modelos
              </Link>
            }
          />
        ))}
    </section>
  );
}

export function PaginaNovedades() {
  const { data: products, error, isLoading } = useCargarDatos(() => api.listarProductos({ order: "nuevos" }), []);
  const arrivals = products?.filter((product) => product.is_new) ?? [];

  if (isLoading) return <Cargando />;
  if (error) return <EstadoError error={error} />;

  return (
    <section className="wrapper page">
      <MigasDePan trail={[{ label: "Inicio", to: "/" }, { label: "Novedades" }]} />
      <div className="catalog-heading">
        <h1 className="display">Novedades</h1>
        <span className="muted">Modelos que llegaron en los últimos 30 días</span>
      </div>
      {arrivals.length ? (
        <div className="card-grid">
          {arrivals.map((product) => (
            <TarjetaProducto key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EstadoVacio
          message="Esta semana no entraron modelos nuevos."
          action={
            <Link className="button" to="/modelos">
              Ver todos los modelos
            </Link>
          }
        />
      )}
    </section>
  );
}
