import { api } from "../api.js";
import { fromMarkup, h, replaceContent } from "../dom.js";
import { PLAY_STYLES, SURFACES, courtDiagram } from "../playStyles.js";
import { productCard } from "./productCard.js";

function styleOption(playStyle, onSelect) {
  const style = PLAY_STYLES[playStyle];
  return h(
    "label",
    { class: "finder-option" },
    h("input", { type: "radio", name: "play_style", value: playStyle, onchange: onSelect }),
    h(
      "span",
      { class: "finder-option__box" },
      fromMarkup(courtDiagram(playStyle)),
      h("span", { class: "finder-option__role" }, style.role),
      h("strong", { class: "finder-option__label" }, style.label),
      h("span", { class: "finder-option__summary" }, style.summary)
    )
  );
}

function surfaceOption(surface, onSelect) {
  const option = SURFACES[surface];
  return h(
    "label",
    { class: "finder-chip" },
    h("input", { type: "radio", name: "surface", value: surface, onchange: onSelect }),
    h("span", {}, h("strong", {}, option.label), h("small", {}, option.detail))
  );
}

function recommendationNote(recommendation, surface) {
  if (surface === "BOTH") {
    return recommendation.product.surface === "BOTH" ? "Rinde igual adentro y afuera." : `Mejor para ${SURFACES[recommendation.product.surface].label.toLowerCase()}.`;
  }
  return recommendation.matches_surface
    ? `Apta para ${SURFACES[surface].label.toLowerCase()}.`
    : "Va con tu estilo, aunque no es la más indicada para esa superficie.";
}

export function styleFinder() {
  const form = h("form", { class: "finder__form", onsubmit: (event) => event.preventDefault() });
  const results = h("div", { class: "finder__results", "aria-live": "polite" });
  let latestRequest = 0;

  async function updateRecommendations() {
    const selection = new FormData(form);
    const playStyle = selection.get("play_style");
    const surface = selection.get("surface");
    if (!playStyle || !surface) {
      replaceContent(results, h("p", { class: "finder__hint" }, playStyle ? "Ahora dinos dónde juegas." : "Elige tu estilo de juego para empezar."));
      return;
    }

    const requestId = ++latestRequest;
    replaceContent(results, h("p", { class: "finder__hint" }, "Buscando modelos…"));
    try {
      const recommendations = await api.recommendProducts(playStyle, surface);
      if (requestId !== latestRequest) return;
      const style = PLAY_STYLES[playStyle];

      if (recommendations.length === 0) {
        replaceContent(results, h("p", { class: "finder__hint" }, "Por ahora no tenemos stock para esa combinación. Vuelve a mirar en unos días."));
        return;
      }

      replaceContent(
        results,
        h(
          "div",
          { class: "finder__results-heading" },
          h("h3", {}, `Para tu juego de ${style.label.toLowerCase()}`),
          h("a", { class: "text-link", href: `#/modelos?estilo=${playStyle}` }, `Ver todos los de ${style.label.toLowerCase()}`)
        ),
        h(
          "div",
          { class: "finder__grid" },
          recommendations.map((recommendation) => productCard(recommendation.product, { note: recommendationNote(recommendation, surface) }))
        )
      );
    } catch (error) {
      if (requestId === latestRequest) replaceContent(results, h("p", { class: "finder__hint" }, error.message));
    }
  }

  form.append(
    h(
      "fieldset",
      { class: "finder__step" },
      h("legend", {}, h("span", { class: "finder__step-number" }, "1"), "¿Cómo juegas?"),
      h("div", { class: "finder__styles" }, Object.keys(PLAY_STYLES).map((playStyle) => styleOption(playStyle, updateRecommendations)))
    ),
    h(
      "fieldset",
      { class: "finder__step" },
      h("legend", {}, h("span", { class: "finder__step-number" }, "2"), "¿Dónde juegas?"),
      h("div", { class: "finder__surfaces" }, Object.keys(SURFACES).map((surface) => surfaceOption(surface, updateRecommendations)))
    )
  );

  updateRecommendations();
  return h("div", { class: "finder" }, form, results);
}
