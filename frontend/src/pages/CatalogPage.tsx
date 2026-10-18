import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { CatalogOrder } from "../api/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "../components/PageStates";
import { ProductCard } from "../components/ProductCard";
import { useAsync } from "../hooks/useAsync";
import { catalogPath } from "../lib/catalogPath";
import { pluralize } from "../lib/format";
import { PLAY_STYLES, PLAY_STYLE_KEYS, isPlayStyle } from "../lib/playStyles";

const ORDER_OPTIONS: Record<CatalogOrder, string> = {
  nuevos: "Más nuevos",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
};

function isCatalogOrder(value: string | null): value is CatalogOrder {
  return value !== null && value in ORDER_OPTIONS;
}

export function CatalogPage() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();

  const search = (searchParameters.get("q") ?? "").trim();
  const requestedStyle = searchParameters.get("estilo");
  const playStyle = isPlayStyle(requestedStyle) ? requestedStyle : "";
  const requestedOrder = searchParameters.get("orden");
  const order: CatalogOrder = isCatalogOrder(requestedOrder) ? requestedOrder : "nuevos";

  const { data: products, error, isLoading } = useAsync(
    () => api.listProducts({ search, playStyle, order }),
    [search, playStyle, order]
  );

  const title = search
    ? `Resultados para “${search}”`
    : playStyle
      ? `Modelos de ${PLAY_STYLES[playStyle].label.toLowerCase()}`
      : "Todos los modelos";

  return (
    <section className="wrapper page">
      <Breadcrumbs trail={[{ label: "Inicio", to: "/" }, { label: "Modelos" }]} />
      <div className="catalog-heading">
        <h1 className="display">{title}</h1>
        {products && <span className="muted">{pluralize(products.length, "modelo", "modelos")}</span>}
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filtrar por estilo de juego">
          <Link className="chip" to={catalogPath({ search, order })} aria-current={!playStyle ? "true" : undefined}>
            Todos
          </Link>
          {PLAY_STYLE_KEYS.map((key) => (
            <Link
              key={key}
              className="chip"
              to={catalogPath({ search, playStyle: key, order })}
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
            onChange={(event) => navigate(catalogPath({ search, playStyle, order: event.target.value as CatalogOrder }))}
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
          <Link className="text-link" to={catalogPath({ playStyle, order })}>
            Quitar búsqueda
          </Link>
        </p>
      )}

      {isLoading && !products && <LoadingState />}
      {error && <ErrorState error={error} />}
      {products &&
        (products.length ? (
          <div className="card-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
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

export function NewArrivalsPage() {
  const { data: products, error, isLoading } = useAsync(() => api.listProducts({ order: "nuevos" }), []);
  const arrivals = products?.filter((product) => product.is_new) ?? [];

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <section className="wrapper page">
      <Breadcrumbs trail={[{ label: "Inicio", to: "/" }, { label: "Novedades" }]} />
      <div className="catalog-heading">
        <h1 className="display">Novedades</h1>
        <span className="muted">Modelos que llegaron en los últimos 30 días</span>
      </div>
      {arrivals.length ? (
        <div className="card-grid">
          {arrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState
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
