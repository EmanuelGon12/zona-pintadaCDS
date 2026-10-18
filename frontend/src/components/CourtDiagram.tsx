import type { PlayStyle } from "../api/types";
import { PLAY_STYLES } from "../lib/playStyles";

export function CourtDiagram({ playStyle }: { playStyle: PlayStyle }) {
  const { x, y } = PLAY_STYLES[playStyle].marker;
  return (
    <svg className="court-diagram" viewBox="0 0 120 90" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="118" height="88" rx="2" />
        <rect x="44" y="52" width="32" height="37" />
        <circle cx="60" cy="52" r="12" />
        <path d="M8 89 V70 A52 52 0 0 1 112 70 V89" />
        <circle cx="60" cy="80" r="3" />
      </g>
      <circle cx={x} cy={y} r="6" className="court-diagram__marker" />
    </svg>
  );
}
