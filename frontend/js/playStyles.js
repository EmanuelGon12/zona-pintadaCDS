export const PLAY_STYLES = {
  SPEED: {
    label: "Velocidad",
    role: "Base o armador",
    summary: "Arrancas, frenas y cambias de ritmo todo el partido. Te conviene algo liviano, de corte bajo o medio.",
    marker: { x: 60, y: 20 },
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

export const SURFACES = {
  INDOOR: { label: "Cancha cubierta", detail: "Parqué o piso sintético" },
  OUTDOOR: { label: "Exterior", detail: "Cemento o asfalto" },
  BOTH: { label: "Las dos", detail: "Depende del día" },
};

export function courtDiagram(playStyle) {
  const { x, y } = PLAY_STYLES[playStyle].marker;
  return `<svg class="court-diagram" viewBox="0 0 120 90" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="1" y="1" width="118" height="88" rx="2"/>
      <rect x="44" y="52" width="32" height="37"/>
      <circle cx="60" cy="52" r="12"/>
      <path d="M8 89 V70 A52 52 0 0 1 112 70 V89"/>
      <circle cx="60" cy="80" r="3"/>
    </g>
    <circle cx="${x}" cy="${y}" r="6" class="court-diagram__marker"/>
  </svg>`;
}
