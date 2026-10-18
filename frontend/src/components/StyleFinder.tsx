import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { CourtSurface, PlayStyle, Recommendation } from "../api/types";
import { PLAY_STYLES, PLAY_STYLE_KEYS, SURFACES, SURFACE_KEYS, describeRecommendation } from "../lib/playStyles";
import { CourtDiagram } from "./CourtDiagram";
import { ProductCard } from "./ProductCard";

type FinderResult =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; recommendations: Recommendation[] }
  | { state: "failed"; message: string };

function FinderResults({ playStyle, surface, result }: { playStyle: PlayStyle | null; surface: CourtSurface | null; result: FinderResult }) {
  if (!playStyle) return <p className="finder__hint">Elige tu estilo de juego para empezar.</p>;
  if (!surface) return <p className="finder__hint">Ahora dinos dónde juegas.</p>;
  if (result.state === "loading" || result.state === "idle") return <p className="finder__hint">Buscando modelos…</p>;
  if (result.state === "failed") return <p className="finder__hint">{result.message}</p>;
  if (result.recommendations.length === 0) {
    return <p className="finder__hint">Por ahora no tenemos stock para esa combinación. Vuelve a mirar en unos días.</p>;
  }

  const styleLabel = PLAY_STYLES[playStyle].label.toLowerCase();
  return (
    <>
      <div className="finder__results-heading">
        <h3>Para tu juego de {styleLabel}</h3>
        <Link className="text-link" to={`/modelos?estilo=${playStyle}`}>
          Ver todos los de {styleLabel}
        </Link>
      </div>
      <div className="finder__grid">
        {result.recommendations.map((recommendation) => (
          <ProductCard
            key={recommendation.product.id}
            product={recommendation.product}
            note={describeRecommendation(recommendation, surface)}
          />
        ))}
      </div>
    </>
  );
}

export function StyleFinder() {
  const [playStyle, setPlayStyle] = useState<PlayStyle | null>(null);
  const [surface, setSurface] = useState<CourtSurface | null>(null);
  const [result, setResult] = useState<FinderResult>({ state: "idle" });

  useEffect(() => {
    if (!playStyle || !surface) return;
    let isCurrent = true;
    setResult({ state: "loading" });
    api.recommendProducts(playStyle, surface).then(
      (recommendations) => isCurrent && setResult({ state: "ready", recommendations }),
      (error: Error) => isCurrent && setResult({ state: "failed", message: error.message })
    );
    return () => {
      isCurrent = false;
    };
  }, [playStyle, surface]);

  return (
    <div className="finder">
      <form className="finder__form" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="finder__step">
          <legend>
            <span className="finder__step-number">1</span>¿Cómo juegas?
          </legend>
          <div className="finder__styles">
            {PLAY_STYLE_KEYS.map((key) => (
              <label key={key} className="finder-option">
                <input type="radio" name="play_style" value={key} checked={playStyle === key} onChange={() => setPlayStyle(key)} />
                <span className="finder-option__box">
                  <CourtDiagram playStyle={key} />
                  <span className="finder-option__role">{PLAY_STYLES[key].role}</span>
                  <strong className="finder-option__label">{PLAY_STYLES[key].label}</strong>
                  <span className="finder-option__summary">{PLAY_STYLES[key].summary}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="finder__step">
          <legend>
            <span className="finder__step-number">2</span>¿Dónde juegas?
          </legend>
          <div className="finder__surfaces">
            {SURFACE_KEYS.map((key) => (
              <label key={key} className="finder-chip">
                <input type="radio" name="surface" value={key} checked={surface === key} onChange={() => setSurface(key)} />
                <span>
                  <strong>{SURFACES[key].label}</strong>
                  <small>{SURFACES[key].detail}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
      <div className="finder__results" aria-live="polite">
        <FinderResults playStyle={playStyle} surface={surface} result={result} />
      </div>
    </div>
  );
}
