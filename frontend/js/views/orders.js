import { api } from "../api.js";
import { refreshCartItemCount } from "../cartStore.js";
import { h } from "../dom.js";
import {
  ORDER_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatOrderNumber,
  formatPrice,
} from "../format.js";
import { replaceLocation } from "../router.js";

function statusBadge(status) {
  return h("span", { class: `badge badge--${status.toLowerCase()}` }, ORDER_STATUS_LABELS[status]);
}

export async function orderListView() {
  const orders = await api.listOrders();

  if (orders.length === 0) {
    return h(
      "section",
      { class: "wrapper page" },
      h("h1", { class: "display" }, "Mis pedidos"),
      h(
        "div",
        { class: "empty-state" },
        h("p", {}, "Todavía no hiciste ningún pedido."),
        h("a", { class: "button", href: "#/" }, "Ver los modelos")
      )
    );
  }

  return h(
    "section",
    { class: "wrapper page" },
    h("h1", { class: "display" }, "Mis pedidos"),
    h(
      "table",
      { class: "data-table" },
      h(
        "thead",
        {},
        h("tr", {}, h("th", {}, "Pedido"), h("th", {}, "Fecha"), h("th", {}, "Pares"), h("th", {}, "Estado"), h("th", { class: "numeric" }, "Total"))
      ),
      h(
        "tbody",
        {},
        orders.map((order) =>
          h(
            "tr",
            {},
            h("td", { "data-label": "Pedido" }, h("a", { class: "text-link", href: `#/pedidos/${order.id}` }, formatOrderNumber(order.id))),
            h("td", { "data-label": "Fecha" }, formatDate(order.created_at)),
            h("td", { "data-label": "Pares" }, order.items.reduce((sum, item) => sum + item.quantity, 0)),
            h("td", { "data-label": "Estado" }, statusBadge(order.status)),
            h("td", { class: "numeric", "data-label": "Total" }, formatPrice(order.total_cents))
          )
        )
      )
    )
  );
}

async function resolvePaymentReturn(orderId, query) {
  if (query.get("pago") !== "exitoso") return null;
  replaceLocation(`/pedidos/${orderId}`);
  try {
    const confirmedOrder = await api.confirmPayment(orderId);
    await refreshCartItemCount();
    return confirmedOrder;
  } catch {
    return null;
  }
}

function paymentBanner(order, cameFromPayment) {
  if (order.status === "PAID" && cameFromPayment) {
    return h("div", { class: "banner banner--ok" }, h("strong", {}, "Pago aprobado."), " Ya estamos preparando tu pedido.");
  }
  if (order.status === "PENDING" && cameFromPayment) {
    return h(
      "div",
      { class: "banner banner--warn" },
      h("strong", {}, "Estamos confirmando tu pago."),
      " Puede tardar unos segundos. ",
      h("a", { class: "text-link", href: `#/pedidos/${order.id}`, onclick: () => window.location.reload() }, "Actualizar")
    );
  }
  if (order.status === "CANCELLED") {
    return h("div", { class: "banner banner--error" }, "Este pedido fue cancelado y no se realizó ningún cobro.");
  }
  return null;
}

export async function orderDetailView({ params, query }) {
  const confirmedOrder = await resolvePaymentReturn(params.orderId, query);
  const order = confirmedOrder ?? (await api.getOrder(params.orderId));

  return h(
    "section",
    { class: "wrapper page order" },
    h("a", { class: "text-link back-link", href: "#/pedidos" }, "← Mis pedidos"),
    h(
      "div",
      { class: "order__heading" },
      h("h1", { class: "display" }, `Pedido ${formatOrderNumber(order.id)}`),
      statusBadge(order.status)
    ),
    paymentBanner(order, query.get("pago") === "exitoso"),
    h(
      "p",
      { class: "order__date" },
      `Realizado el ${formatDateTime(order.created_at)}`,
      order.paid_at ? ` · Pagado el ${formatDateTime(order.paid_at)}` : ""
    ),
    h(
      "ul",
      { class: "order-lines" },
      order.items.map((item) =>
        h(
          "li",
          { class: "order-line" },
          h("div", { class: "order-line__image" }, item.image_url ? h("img", { src: item.image_url, alt: "" }) : null),
          h(
            "div",
            { class: "order-line__info" },
            h("p", { class: "order-line__name" }, item.product_name),
            h("p", { class: "order-line__meta" }, `Talla ${item.size} · ${item.quantity} × ${formatPrice(item.unit_price_cents)}`)
          ),
          h("p", { class: "order-line__total" }, formatPrice(item.line_total_cents))
        )
      )
    ),
    h(
      "dl",
      { class: "order-totals" },
      h("div", {}, h("dt", {}, "Subtotal"), h("dd", {}, formatPrice(order.subtotal_cents))),
      h("div", {}, h("dt", {}, "Envío"), h("dd", {}, order.shipping_cents === 0 ? "Gratis" : formatPrice(order.shipping_cents))),
      h("div", { class: "order-totals__final" }, h("dt", {}, "Total"), h("dd", {}, formatPrice(order.total_cents)))
    )
  );
}
