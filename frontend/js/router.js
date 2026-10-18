import { h, replaceContent } from "./dom.js";
import { isAdministrator, isAuthenticated } from "./session.js";

const routeListeners = new Set();
let routes = [];
let activeRenderId = 0;
let currentLocation = { path: "/", query: new URLSearchParams() };

function compilePath(path) {
  const parameterNames = [];
  const pattern = path.replace(/:([a-zA-Z]+)/g, (_match, name) => {
    parameterNames.push(name);
    return "([^/]+)";
  });
  return { expression: new RegExp(`^${pattern}$`), parameterNames };
}

function readLocation() {
  const rawHash = window.location.hash.replace(/^#/, "") || "/";
  const [path, queryString = ""] = rawHash.split("?");
  return { path: path || "/", query: new URLSearchParams(queryString) };
}

export const getLocation = () => currentLocation;

export function navigate(path) {
  window.location.hash = `#${path}`;
}

export function replaceLocation(path) {
  history.replaceState(null, "", `#${path}`);
  currentLocation = readLocation();
}

export function onRouteChange(listener) {
  routeListeners.add(listener);
}

function accessDeniedView() {
  return h(
    "section",
    { class: "wrapper page message-page" },
    h("h1", { class: "display" }, "Sin acceso"),
    h("p", {}, "Esta sección es solo para administradores."),
    h("a", { class: "button", href: "#/" }, "Volver al catálogo")
  );
}

function errorView(error) {
  return h(
    "section",
    { class: "wrapper page message-page" },
    h("h1", { class: "display" }, "Algo salió mal"),
    h("p", {}, error.message || "No pudimos cargar esta página."),
    h("a", { class: "button", href: "#/" }, "Volver al catálogo")
  );
}

function loadingView() {
  return h("div", { class: "wrapper page loading", role: "status" }, "Cargando…");
}

export function startRouter(routeDefinitions, outlet, notFoundView) {
  routes = routeDefinitions.map((definition) => ({ ...definition, ...compilePath(definition.path) }));

  async function render() {
    currentLocation = readLocation();
    const renderId = ++activeRenderId;
    const { path, query } = currentLocation;

    routeListeners.forEach((listener) => listener(currentLocation));

    let matchedRoute = null;
    let params = {};
    for (const route of routes) {
      const match = route.expression.exec(path);
      if (match) {
        matchedRoute = route;
        params = Object.fromEntries(route.parameterNames.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
        break;
      }
    }

    if (matchedRoute && matchedRoute.access !== "public" && !isAuthenticated()) {
      navigate(`/ingresar?volver=${encodeURIComponent(window.location.hash.replace(/^#/, ""))}`);
      return;
    }

    replaceContent(outlet, loadingView());
    window.scrollTo(0, 0);

    let view;
    try {
      if (matchedRoute?.access === "admin" && !isAdministrator()) {
        view = accessDeniedView();
      } else if (matchedRoute) {
        view = await matchedRoute.view({ params, query });
      } else {
        view = notFoundView();
      }
    } catch (error) {
      view = errorView(error);
    }

    if (renderId === activeRenderId && view) {
      replaceContent(outlet, view);
      outlet.focus({ preventScroll: true });
    }
  }

  window.addEventListener("hashchange", render);
  return render;
}
