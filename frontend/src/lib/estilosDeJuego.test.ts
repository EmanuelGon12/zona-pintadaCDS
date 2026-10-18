import { describe, expect, it } from "vitest";
import type { Product, Recommendation } from "../api/tipos";
import { explicarRecomendacion, esEstiloDeJuego } from "./estilosDeJuego";

function recomendacion(surface: Product["surface"], matchesSurface: boolean): Recommendation {
  return { product: { surface } as Product, matches_surface: matchesSurface };
}

describe("explicarRecomendacion", () => {
  it("indica cuando el modelo es apto para la superficie elegida", () => {
    expect(explicarRecomendacion(recomendacion("OUTDOOR", true), "OUTDOOR")).toBe("Apta para exterior.");
  });

  it("aclara cuando el modelo solo coincide en estilo", () => {
    expect(explicarRecomendacion(recomendacion("INDOOR", false), "OUTDOOR")).toMatch(/no es la más indicada/);
  });

  it("orienta a quien juega en ambas superficies", () => {
    expect(explicarRecomendacion(recomendacion("BOTH", true), "BOTH")).toBe("Rinde igual adentro y afuera.");
    expect(explicarRecomendacion(recomendacion("INDOOR", false), "BOTH")).toBe("Mejor para cancha cubierta.");
  });
});

it("reconoce solo estilos de juego válidos", () => {
  expect(esEstiloDeJuego("POWER")).toBe(true);
  expect(esEstiloDeJuego("DUNK")).toBe(false);
  expect(esEstiloDeJuego(null)).toBe(false);
});
