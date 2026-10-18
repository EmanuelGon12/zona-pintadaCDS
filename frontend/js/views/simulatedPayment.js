import { api } from "../api.js";
import { h } from "../dom.js";
import { formatOrderNumber, formatPrice } from "../format.js";
import { navigate } from "../router.js";

function formatCardNumber(rawValue) {
  return rawValue
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(rawValue) {
  const digits = rawValue.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

export async function simulatedPaymentView({ params }) {
  const order = await api.getOrder(params.orderId);

  if (order.status !== "PENDING") {
    navigate(`/pedidos/${order.id}`);
    return null;
  }

  const errorSlot = h("p", { class: "form-error", role: "alert", hidden: true });

  async function pay(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector("button[type=submit]");
    errorSlot.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Procesando…";
    try {
      await api.paySimulated(order.id, new FormData(form).get("card_number"));
      navigate(`/pedidos/${order.id}?pago=exitoso`);
    } catch (error) {
      errorSlot.textContent = error.message;
      errorSlot.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = `Pagar ${formatPrice(order.total_cents)}`;
    }
  }

  return h(
    "section",
    { class: "wrapper page payment" },
    h(
      "div",
      { class: "payment__panel" },
      h("p", { class: "kicker" }, "Pasarela de prueba"),
      h("h1", { class: "display" }, "Pagar con tarjeta"),
      h("p", { class: "payment__order" }, `Pedido ${formatOrderNumber(order.id)} · ${formatPrice(order.total_cents)}`),
      h(
        "form",
        { class: "form", onsubmit: pay },
        h(
          "div",
          { class: "field-group" },
          h("label", { class: "field-label", for: "card_number" }, "Número de tarjeta"),
          h("input", {
            class: "input",
            id: "card_number",
            name: "card_number",
            inputmode: "numeric",
            autocomplete: "off",
            placeholder: "4242 4242 4242 4242",
            required: true,
            oninput: (event) => {
              event.target.value = formatCardNumber(event.target.value);
            },
          })
        ),
        h(
          "div",
          { class: "form-row" },
          h(
            "div",
            { class: "field-group" },
            h("label", { class: "field-label", for: "card_expiry" }, "Vencimiento"),
            h("input", {
              class: "input",
              id: "card_expiry",
              inputmode: "numeric",
              placeholder: "MM / AA",
              autocomplete: "off",
              oninput: (event) => {
                event.target.value = formatExpiry(event.target.value);
              },
            })
          ),
          h(
            "div",
            { class: "field-group" },
            h("label", { class: "field-label", for: "card_cvc" }, "CVC"),
            h("input", { class: "input", id: "card_cvc", inputmode: "numeric", maxlength: "4", placeholder: "123", autocomplete: "off" })
          )
        ),
        errorSlot,
        h("button", { class: "button button--wide", type: "submit" }, `Pagar ${formatPrice(order.total_cents)}`),
        h("a", { class: "text-link payment__cancel", href: `#/carrito?pago=cancelado&orden=${order.id}` }, "Cancelar y volver al carrito")
      ),
      h(
        "div",
        { class: "payment__test-cards" },
        h("p", {}, h("strong", {}, "Tarjetas de prueba")),
        h("p", {}, "4242 4242 4242 4242 · aprueba el pago"),
        h("p", {}, "4000 0000 0000 0002 · el banco la rechaza")
      )
    )
  );
}
