import { h } from "../dom.js";
import { formatPrice } from "../format.js";
import { PLAY_STYLES } from "../playStyles.js";

function cardBadge(product) {
  if (product.stock === 0) return h("span", { class: "card__badge card__badge--muted" }, "Agotado");
  if (product.is_new) return h("span", { class: "card__badge" }, "Nuevo");
  return null;
}

export function productCard(product, { note } = {}) {
  return h(
    "a",
    { class: "card", href: `#/producto/${product.id}` },
    h(
      "div",
      { class: "card__media" },
      product.image_url
        ? h("img", { src: product.image_url, alt: `${product.name}, ${product.colorway}`, loading: "lazy" })
        : h("span", { class: "card__placeholder" }, "Sin imagen"),
      cardBadge(product)
    ),
    h(
      "div",
      { class: "card__body" },
      h("p", { class: "card__style" }, PLAY_STYLES[product.play_style]?.label),
      h("h3", { class: "card__name" }, product.name),
      h("p", { class: "card__colorway" }, product.colorway),
      h("p", { class: "card__price" }, formatPrice(product.price_cents)),
      note ? h("p", { class: "card__note" }, note) : null
    )
  );
}
