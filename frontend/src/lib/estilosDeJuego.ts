import type { CourtSurface, PlayStyle, Recommendation } from "../api/tipos";

interface PlayStyleDescription {
  label: string;
  role: string;
  summary: string;
  marker: { x: number; y: number };
}

export const PLAY_STYLES: Record<PlayStyle, PlayStyleDescription> = {
  SPEED: {
    label: "Velocidad",
    role: "Base o armador",
    summary: "Arrancas, frenas y cambias de ritmo todo el partido. Te conviene algo liviano, de corte bajo o medio.",
    marker: { x: 60, y: 20 }, // posicion del punto en el dibujo de la cancha
  },
  ALL_AROUND: {
    label: "Versátil",
    role: "Escolta o alero",
    summary: "Tiras, penetras y defiendes en toda la cancha. Buscas equilibrio entre amortiguación y respuesta.",
    marker: { x: 101, y: 44 },
  },
  POWER: {
    label: "Potencia",
    role: "Pívot o ala-pívot",
    summary: "Juegas de espaldas al aro, con contacto, rebotes y saltos. Necesitas corte alto y buen soporte de tobillo.",
    marker: { x: 38, y: 74 },
  },
};

export const SURFACES: Record<CourtSurface, { label: string; detail: string }> = {
  INDOOR: { label: "Cancha cubierta", detail: "Parqué o piso sintético" },
  OUTDOOR: { label: "Exterior", detail: "Cemento o asfalto" },
  BOTH: { label: "Las dos", detail: "Depende del día" },
};

export const PLAY_STYLE_KEYS = Object.keys(PLAY_STYLES) as PlayStyle[];
export const SURFACE_KEYS = Object.keys(SURFACES) as CourtSurface[];

export function esEstiloDeJuego(value: string | null): value is PlayStyle {
  return value !== null && value in PLAY_STYLES;
}

export function explicarRecomendacion(recommendation: Recommendation, desiredSurface: CourtSurface): string {
  const productSurface = recommendation.product.surface;
  if (desiredSurface === "BOTH") {
    return productSurface === "BOTH" ? "Rinde igual adentro y afuera." : `Mejor para ${SURFACES[productSurface].label.toLowerCase()}.`;
  }
  return recommendation.matches_surface
    ? `Apta para ${SURFACES[desiredSurface].label.toLowerCase()}.`
    : "Va con tu estilo, aunque no es la más indicada para esa superficie.";
}
