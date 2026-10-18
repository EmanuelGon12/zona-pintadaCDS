import { refreshCartItemCount, subscribeToCart } from "./cartStore.js";
import { renderHeader } from "./components/header.js";
import { h } from "./dom.js";
import { onRouteChange, startRouter } from "./router.js";
import { subscribeToSession } from "./session.js";
import { adminProductFormView, adminProductListView } from "./views/admin.js";
import { loginView, registrationView } from "./views/authentication.js";
import { cartView } from "./views/cart.js";
import { catalogView, newArrivalsView } from "./views/catalog.js";
import { homeView, styleFinderView } from "./views/home.js";
import { orderDetailView, orderListView } from "./views/orders.js";
import { productDetailView } from "./views/productDetail.js";
import { simulatedPaymentView } from "./views/simulatedPayment.js";

const headerSlot = document.getElementById("header-slot");
const viewSlot = document.getElementById("view-slot");

const routes = [
  { path: "/", access: "public", view: homeView },
  { path: "/modelos", access: "public", view: catalogView },
  { path: "/novedades", access: "public", view: newArrivalsView },
  { path: "/estilo-de-juego", access: "public", view: styleFinderView },
  { path: "/producto/:productId", access: "public", view: productDetailView },
  { path: "/ingresar", access: "public", view: loginView },
  { path: "/registro", access: "public", view: registrationView },
  { path: "/carrito", access: "authenticated", view: cartView },
  { path: "/pago-simulado/:orderId", access: "authenticated", view: simulatedPaymentView },
  { path: "/pedidos", access: "authenticated", view: orderListView },
  { path: "/pedidos/:orderId", access: "authenticated", view: orderDetailView },
  { path: "/admin", access: "admin", view: adminProductListView },
  { path: "/admin/productos/nuevo", access: "admin", view: adminProductFormView },
  { path: "/admin/productos/:productId", access: "admin", view: adminProductFormView },
];

function notFoundView() {
  return h(
    "section",
    { class: "wrapper page message-page" },
    h("h1", { class: "display" }, "No encontramos esa página"),
    h("a", { class: "button", href: "#/" }, "Volver al catálogo")
  );
}

const renderCurrentRoute = startRouter(routes, viewSlot, notFoundView);
const refreshHeader = () => renderHeader(headerSlot);

onRouteChange(refreshHeader);
subscribeToCart(refreshHeader);
subscribeToSession(refreshHeader);

refreshHeader();
refreshCartItemCount();
renderCurrentRoute();
