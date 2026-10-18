import { api } from "../api.js";
import { productCard } from "../components/productCard.js";
import { styleFinder } from "../components/styleFinder.js";
import { h } from "../dom.js";

const HERO_IMAGE = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=2000&q=80";
const NEW_ARRIVALS_ON_HOME = 4;

function hero() {
  return h(
    "section",
    { class: "hero", style: `background-image: url('${HERO_IMAGE}')` },
    h(
      "div",
      { class: "wrapper hero__content" },
      h("p", { class: "hero__eyebrow" }, "Temporada 2026"),
      h("h1", { class: "hero__title" }, "Zapatillas para jugar, no para mirar."),
      h(
        "p",
        { class: "hero__lead" },
        "Modelos de básquetbol para cancha cubierta y exterior, elegidos por posición. Envío a todo el país y cambios dentro de 30 días."
      ),
      h(
        "div",
        { class: "hero__actions" },
        h("a", { class: "button button--inverted", href: "#/novedades" }, "Ver novedades"),
        h("a", { class: "button button--ghost", href: "#/estilo-de-juego" }, "Encuentra tu zapatilla")
      )
    )
  );
}

function newArrivalsSection(products) {
  return h(
    "section",
    { class: "wrapper section" },
    h(
      "div",
      { class: "section-heading" },
      h("div", {}, h("h2", { class: "section-heading__title" }, "Novedades"), h("p", { class: "section-heading__lead" }, "Lo último que llegó a la tienda.")),
      h("a", { class: "text-link", href: "#/novedades" }, "Ver todas")
    ),
    h("div", { class: "rail" }, products.map((product) => productCard(product)))
  );
}

export function finderSection({ asPage = false } = {}) {
  const Heading = asPage ? "h1" : "h2";
  return h(
    "section",
    { class: "finder-band", id: "estilo" },
    h(
      "div",
      { class: "wrapper" },
      h(
        "div",
        { class: "finder-band__intro" },
        h(Heading, { class: "finder-band__title" }, "Encuentra tu zapatilla"),
        h(
          "p",
          {},
          "No todos juegan igual. Cuéntanos tu posición y dónde juegas, y te mostramos los modelos que mejor se adaptan."
        )
      ),
      styleFinder()
    )
  );
}

function serviceStrip() {
  const facts = [
    ["Envío en 24 a 72 h", "Gratis en compras desde USD 150. Despachamos de lunes a viernes."],
    ["Cambios sin costo", "Si la talla no te queda, tienes 30 días para cambiarla."],
    ["Pago seguro", "Tarjeta de crédito o débito. No guardamos los datos de tu tarjeta."],
  ];
  return h(
    "section",
    { class: "wrapper services" },
    facts.map(([title, text]) => h("div", { class: "services__item" }, h("h3", {}, title), h("p", {}, text)))
  );
}

export async function homeView() {
  const newest = await api.listProducts({ order: "nuevos", limit: 8 });
  const arrivals = newest.filter((product) => product.is_new);
  const featured = (arrivals.length ? arrivals : newest).slice(0, NEW_ARRIVALS_ON_HOME);

  return h("div", {}, hero(), featured.length ? newArrivalsSection(featured) : null, finderSection(), serviceStrip());
}

export function styleFinderView() {
  return h("div", { class: "finder-page" }, finderSection({ asPage: true }));
}
