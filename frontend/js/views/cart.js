import { api } from "../api.js";
import { setCartItemCount } from "../cartStore.js";
import { showToast } from "../components/toast.js";
import { h, replaceContent } from "../dom.js";
import { formatPrice } from "../format.js";
import { replaceLocation } from "../router.js";

async function discardAbandonedCheckout(query) {
  if (query.get("pago") !== "cancelado") return;
  const orderId = query.get("orden");
  replaceLocation("/carrito");
  if (orderId) {
    await api.abandonCheckout(orderId).catch(() => null);
  }
  showToast("Cancelaste el pago. Tu carrito sigue como lo dejaste.");
}

function summaryRow(label, value, modifier = "") {
  return h("div", { class: `summary__row ${modifier}` }, h("dt", {}, label), h("dd", {}, value));
}

export async function cartView({ query }) {
  await discardAbandonedCheckout(query);

  const container = h("section", { class: "wrapper page" });
  let cart = await api.getCart();
  setCartItemCount(cart.item_count);

  async function applyChange(action) {
    try {
      cart = await action();
      setCartItemCount(cart.item_count);
      draw();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function goToPayment(event) {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Redirigiendo al pago…";
    try {
      const { checkout_url: checkoutUrl } = await api.startCheckout();
      window.location.assign(checkoutUrl);
    } catch (error) {
      showToast(error.message, "error");
      button.disabled = false;
      button.textContent = "Ir a pagar";
    }
  }

  function lineRow(line) {
    const decrease = () => applyChange(() => api.changeCartQuantity(line.id, line.quantity - 1));
    const increase = () => applyChange(() => api.changeCartQuantity(line.id, line.quantity + 1));
    const remove = () => applyChange(() => api.removeFromCart(line.id));

    return h(
      "li",
      { class: `cart-line${line.is_purchasable ? "" : " cart-line--problem"}` },
      h(
        "a",
        { class: "cart-line__image", href: `#/producto/${line.product.id}` },
        line.product.image_url ? h("img", { src: line.product.image_url, alt: "" }) : null
      ),
      h(
        "div",
        { class: "cart-line__info" },
        h("a", { class: "cart-line__name", href: `#/producto/${line.product.id}` }, line.product.name),
        h("p", { class: "cart-line__meta" }, `${line.product.colorway} · Talla ${line.size}`),
        h("p", { class: "cart-line__meta" }, formatPrice(line.unit_price_cents)),
        line.problem ? h("p", { class: "cart-line__problem" }, line.problem) : null
      ),
      h(
        "div",
        { class: "stepper", role: "group", "aria-label": `Cantidad de ${line.product.name}` },
        h("button", { type: "button", onclick: decrease, disabled: line.quantity <= 1, "aria-label": "Quitar una unidad" }, "−"),
        h("span", { class: "stepper__value" }, line.quantity),
        h("button", { type: "button", onclick: increase, "aria-label": "Agregar una unidad" }, "+")
      ),
      h("p", { class: "cart-line__total" }, formatPrice(line.line_total_cents)),
      h("button", { class: "text-button", type: "button", onclick: remove }, "Quitar")
    );
  }

  function freeShippingHint() {
    if (cart.shipping_cents === 0) return null;
    const remaining = cart.free_shipping_threshold_cents - cart.subtotal_cents;
    return h("p", { class: "summary__hint" }, `Suma ${formatPrice(remaining)} más y el envío es gratis.`);
  }

  function draw() {
    if (cart.lines.length === 0) {
      replaceContent(
        container,
        h("h1", { class: "display" }, "Tu carrito"),
        h(
          "div",
          { class: "empty-state" },
          h("p", {}, "Todavía no agregaste nada."),
          h("a", { class: "button", href: "#/" }, "Ver los modelos")
        )
      );
      return;
    }

    replaceContent(
      container,
      h("h1", { class: "display" }, "Tu carrito"),
      h(
        "div",
        { class: "cart-layout" },
        h("ul", { class: "cart-lines" }, cart.lines.map(lineRow)),
        h(
          "aside",
          { class: "summary" },
          h("h2", { class: "summary__title" }, "Resumen"),
          h(
            "dl",
            {},
            summaryRow(`Subtotal (${cart.item_count} ${cart.item_count === 1 ? "par" : "pares"})`, formatPrice(cart.subtotal_cents)),
            summaryRow("Envío", cart.shipping_cents === 0 ? "Gratis" : formatPrice(cart.shipping_cents)),
            summaryRow("Total", formatPrice(cart.total_cents), "summary__row--total")
          ),
          freeShippingHint(),
          h("button", { class: "button button--wide", type: "button", onclick: goToPayment, disabled: !cart.can_checkout }, "Ir a pagar"),
          cart.can_checkout ? null : h("p", { class: "summary__hint" }, "Resuelve los avisos de tu carrito para continuar.")
        )
      )
    );
  }

  draw();
  return container;
}
