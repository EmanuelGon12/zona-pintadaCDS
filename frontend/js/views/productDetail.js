import { api } from "../api.js";
import { setCartItemCount } from "../cartStore.js";
import { showToast } from "../components/toast.js";
import { fromMarkup, h } from "../dom.js";
import { formatPrice } from "../format.js";
import { PLAY_STYLES, SURFACES, courtDiagram } from "../playStyles.js";
import { navigate } from "../router.js";
import { isAuthenticated } from "../session.js";

const MAXIMUM_UNITS = 10;

function sizePicker(product) {
  return h(
    "fieldset",
    { class: "field-group" },
    h("legend", { class: "field-label" }, "Talla (US)"),
    h(
      "div",
      { class: "size-grid" },
      product.available_sizes.map((size) =>
        h("label", { class: "size-option" }, h("input", { type: "radio", name: "size", value: size }), h("span", {}, size))
      )
    ),
    h("p", { class: "field-hint" }, "Si estás entre dos tallas, te recomendamos la mayor.")
  );
}

function quantityField(product) {
  const maximum = Math.min(MAXIMUM_UNITS, product.stock);
  return h(
    "div",
    { class: "field-group field-group--inline" },
    h("label", { class: "field-label", for: "quantity" }, "Cantidad"),
    h(
      "select",
      { id: "quantity", name: "quantity", class: "select select--compact" },
      Array.from({ length: maximum }, (_unused, index) => h("option", { value: index + 1 }, index + 1))
    )
  );
}

function stockNote(product) {
  if (product.stock === 0) return "Sin stock por el momento.";
  if (product.stock <= 5) return `Quedan ${product.stock} pares.`;
  return null;
}

function playProfile(product) {
  const style = PLAY_STYLES[product.play_style];
  const surface = SURFACES[product.surface];
  return h(
    "div",
    { class: "play-profile" },
    fromMarkup(courtDiagram(product.play_style)),
    h(
      "div",
      {},
      h("p", { class: "play-profile__title" }, `${style.label} · ${style.role}`),
      h("p", { class: "play-profile__text" }, style.summary),
      h("p", { class: "play-profile__surface" }, `Superficie: ${surface.label.toLowerCase()} (${surface.detail.toLowerCase()})`)
    )
  );
}

export async function productDetailView({ params }) {
  const product = await api.getProduct(params.productId);
  const soldOut = product.stock === 0;
  const errorSlot = h("p", { class: "form-error", role: "alert", hidden: true });

  async function addToCart(event) {
    event.preventDefault();
    const form = event.currentTarget;
    errorSlot.hidden = true;

    if (!isAuthenticated()) {
      navigate(`/ingresar?volver=${encodeURIComponent(`/producto/${product.id}`)}`);
      return;
    }

    const formData = new FormData(form);
    const size = formData.get("size");
    if (!size) {
      errorSlot.textContent = "Elige una talla para continuar.";
      errorSlot.hidden = false;
      return;
    }

    const submitButton = form.querySelector("button[type=submit]");
    submitButton.disabled = true;
    try {
      const cart = await api.addToCart(product.id, size, Number(formData.get("quantity")));
      setCartItemCount(cart.item_count);
      showToast(`Agregaste talla ${size} al carrito.`);
    } catch (error) {
      errorSlot.textContent = error.message;
      errorSlot.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  }

  return h(
    "section",
    { class: "wrapper page" },
    h(
      "nav",
      { class: "breadcrumbs", "aria-label": "Ruta" },
      h("a", { href: "#/" }, "Inicio"),
      h("span", { "aria-hidden": "true" }, "/"),
      h("a", { href: "#/modelos" }, "Modelos"),
      h("span", { "aria-hidden": "true" }, "/"),
      h("span", {}, product.name)
    ),
    h(
      "div",
      { class: "detail" },
      h(
        "div",
        { class: "detail__media" },
        product.image_url ? h("img", { src: product.image_url, alt: `${product.name}, ${product.colorway}` }) : null,
        product.is_new ? h("span", { class: "card__badge" }, "Nuevo") : null
      ),
      h(
        "div",
        { class: "detail__info" },
        h("h1", { class: "detail__title" }, product.name),
        h("p", { class: "detail__colorway" }, product.colorway),
        h("p", { class: "detail__price" }, formatPrice(product.price_cents)),
        h(
          "form",
          { class: "detail__form", onsubmit: addToCart, novalidate: true },
          sizePicker(product),
          soldOut ? null : quantityField(product),
          stockNote(product) ? h("p", { class: "stock-note" }, stockNote(product)) : null,
          errorSlot,
          h("button", { class: "button button--wide", type: "submit", disabled: soldOut }, soldOut ? "Sin stock" : "Agregar al carrito")
        ),
        h("p", { class: "detail__description" }, product.description),
        playProfile(product),
        h(
          "dl",
          { class: "detail__facts" },
          h("div", {}, h("dt", {}, "Envío"), h("dd", {}, "Gratis desde USD 150. Llega en 24 a 72 h hábiles.")),
          h("div", {}, h("dt", {}, "Cambios"), h("dd", {}, "Tienes 30 días para cambiar la talla."))
        )
      )
    )
  );
}
