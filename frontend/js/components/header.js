import { getCartItemCount, setCartItemCount } from "../cartStore.js";
import { fromMarkup, h, replaceContent } from "../dom.js";
import { getLocation, navigate } from "../router.js";
import { clearSession, getUser, isAdministrator, isAuthenticated } from "../session.js";
import { showToast } from "./toast.js";

const SEARCH_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const BAG_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const USER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

const PRIMARY_LINKS = [
  ["Novedades", "/novedades"],
  ["Modelos", "/modelos"],
  ["Encuentra tu zapatilla", "/estilo-de-juego"],
];

function navigationLink(label, path, currentPath) {
  const isCurrent = currentPath === path || currentPath.startsWith(`${path}/`);
  return h("a", { class: "primary-nav__link", href: `#${path}`, "aria-current": isCurrent ? "page" : null }, label);
}

function searchForm(initialTerm) {
  return h(
    "form",
    {
      class: "search",
      role: "search",
      onsubmit: (event) => {
        event.preventDefault();
        const term = new FormData(event.currentTarget).get("q").trim();
        navigate(term ? `/modelos?q=${encodeURIComponent(term)}` : "/modelos");
      },
    },
    h("label", { class: "visually-hidden", for: "search-input" }, "Buscar modelos"),
    h("span", { class: "search__icon" }, fromMarkup(SEARCH_ICON)),
    h("input", {
      id: "search-input",
      class: "search__input",
      type: "search",
      name: "q",
      placeholder: "Buscar",
      value: initialTerm,
      autocomplete: "off",
      maxlength: "80",
    })
  );
}

function logOut() {
  clearSession();
  setCartItemCount(0);
  navigate("/");
  showToast("Cerraste sesión.");
}

function accountArea(path) {
  if (!isAuthenticated()) {
    return h("a", { class: "account-link", href: "#/ingresar" }, fromMarkup(USER_ICON), h("span", {}, "Ingresar"));
  }
  const firstName = getUser().full_name.split(" ")[0];
  return h(
    "div",
    { class: "account" },
    h("a", { class: "account-link", href: "#/pedidos", "aria-current": path.startsWith("/pedidos") ? "page" : null }, fromMarkup(USER_ICON), h("span", {}, firstName)),
    isAdministrator() ? h("a", { class: "account__extra", href: "#/admin" }, "Administración") : null,
    h("button", { class: "account__extra account__logout", type: "button", onclick: logOut }, "Salir")
  );
}

export function renderHeader(slot) {
  const { path, query } = getLocation();
  const cartCount = getCartItemCount();

  replaceContent(
    slot,
    h("div", { class: "announcement" }, "Envío gratis desde USD 150 · Cambios dentro de 30 días"),
    h(
      "header",
      { class: "site-header" },
      h(
        "div",
        { class: "wrapper site-header__inner" },
        h("a", { class: "brand", href: "#/", "aria-label": "Zona Pintada, inicio" }, "Zona", h("span", {}, "Pintada")),
        h("nav", { class: "primary-nav", "aria-label": "Principal" }, PRIMARY_LINKS.map(([label, linkPath]) => navigationLink(label, linkPath, path))),
        h(
          "div",
          { class: "site-header__actions" },
          searchForm(path === "/modelos" ? query.get("q") ?? "" : ""),
          accountArea(path),
          h(
            "a",
            { class: "cart-link", href: "#/carrito", "aria-label": `Carrito, ${cartCount} productos` },
            fromMarkup(BAG_ICON),
            cartCount > 0 ? h("span", { class: "cart-link__count" }, cartCount) : null
          )
        )
      )
    )
  );
}
