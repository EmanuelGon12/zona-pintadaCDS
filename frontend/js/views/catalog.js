import { api } from "../api.js";
import { productCard } from "../components/productCard.js";
import { h } from "../dom.js";
import { PLAY_STYLES } from "../playStyles.js";
import { navigate } from "../router.js";

const ORDER_OPTIONS = {
  nuevos: "Más nuevos",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
};

function catalogPath({ search, playStyle, order }) {
  const parameters = new URLSearchParams();
  if (search) parameters.set("q", search);
  if (playStyle) parameters.set("estilo", playStyle);
  if (order && order !== "nuevos") parameters.set("orden", order);
  const queryString = parameters.toString();
  return queryString ? `/modelos?${queryString}` : "/modelos";
}

function filterChip(label, isActive, path) {
  return h("a", { class: "chip", href: `#${path}`, "aria-current": isActive ? "true" : null }, label);
}

function countLabel(count) {
  return `${count} ${count === 1 ? "modelo" : "modelos"}`;
}

export async function catalogView({ query }) {
  const search = (query.get("q") ?? "").trim();
  const requestedStyle = query.get("estilo") ?? "";
  const playStyle = PLAY_STYLES[requestedStyle] ? requestedStyle : "";
  const order = ORDER_OPTIONS[query.get("orden")] ? query.get("orden") : "nuevos";
  const products = await api.listProducts({ search, playStyle, order });

  const title = search ? `Resultados para “${search}”` : playStyle ? `Modelos de ${PLAY_STYLES[playStyle].label.toLowerCase()}` : "Todos los modelos";

  const sortSelect = h(
    "select",
    {
      class: "select select--compact",
      id: "catalog-order",
      value: order,
      onchange: (event) => navigate(catalogPath({ search, playStyle, order: event.target.value })),
    },
    Object.entries(ORDER_OPTIONS).map(([value, label]) => h("option", { value }, label))
  );

  return h(
    "section",
    { class: "wrapper page" },
    h(
      "nav",
      { class: "breadcrumbs", "aria-label": "Ruta" },
      h("a", { href: "#/" }, "Inicio"),
      h("span", { "aria-hidden": "true" }, "/"),
      h("span", {}, "Modelos")
    ),
    h("div", { class: "catalog-heading" }, h("h1", { class: "display" }, title), h("span", { class: "muted" }, countLabel(products.length))),
    h(
      "div",
      { class: "toolbar" },
      h(
        "div",
        { class: "chips", role: "group", "aria-label": "Filtrar por estilo de juego" },
        filterChip("Todos", !playStyle, catalogPath({ search, order })),
        Object.entries(PLAY_STYLES).map(([value, style]) =>
          filterChip(style.label, playStyle === value, catalogPath({ search, playStyle: value, order }))
        )
      ),
      h("div", { class: "toolbar__sort" }, h("label", { for: "catalog-order" }, "Ordenar por"), sortSelect)
    ),
    search ? h("p", { class: "search-note" }, h("a", { class: "text-link", href: `#${catalogPath({ playStyle, order })}` }, "Quitar búsqueda")) : null,
    products.length
      ? h("div", { class: "card-grid" }, products.map((product) => productCard(product)))
      : h("div", { class: "empty-state" }, h("p", {}, "No encontramos modelos con esos filtros."), h("a", { class: "button", href: "#/modelos" }, "Ver todos los modelos"))
  );
}

export async function newArrivalsView() {
  const products = (await api.listProducts({ order: "nuevos" })).filter((product) => product.is_new);

  return h(
    "section",
    { class: "wrapper page" },
    h(
      "nav",
      { class: "breadcrumbs", "aria-label": "Ruta" },
      h("a", { href: "#/" }, "Inicio"),
      h("span", { "aria-hidden": "true" }, "/"),
      h("span", {}, "Novedades")
    ),
    h(
      "div",
      { class: "catalog-heading" },
      h("h1", { class: "display" }, "Novedades"),
      h("span", { class: "muted" }, "Modelos que llegaron en los últimos 30 días")
    ),
    products.length
      ? h("div", { class: "card-grid" }, products.map((product) => productCard(product)))
      : h("div", { class: "empty-state" }, h("p", {}, "Esta semana no entraron modelos nuevos."), h("a", { class: "button", href: "#/modelos" }, "Ver todos los modelos"))
  );
}
