import { describe, expect, it } from "vitest";
import type { Product, Recommendation } from "../api/types";
import { describeRecommendation, isPlayStyle } from "./playStyles";

function recommendation(surface: Product["surface"], matchesSurface: boolean): Recommendation {
  return { product: { surface } as Product, matches_surface: matchesSurface };
}

describe("describeRecommendation", () => {
  it("indica cuando el modelo es apto para la superficie elegida", () => {
    expect(describeRecommendation(recommendation("OUTDOOR", true), "OUTDOOR")).toBe("Apta para exterior.");
  });

  it("aclara cuando el modelo solo coincide en estilo", () => {
    expect(describeRecommendation(recommendation("INDOOR", false), "OUTDOOR")).toMatch(/no es la más indicada/);
  });

  it("orienta a quien juega en ambas superficies", () => {
    expect(describeRecommendation(recommendation("BOTH", true), "BOTH")).toBe("Rinde igual adentro y afuera.");
    expect(describeRecommendation(recommendation("INDOOR", false), "BOTH")).toBe("Mejor para cancha cubierta.");
  });
});

it("reconoce solo estilos de juego válidos", () => {
  expect(isPlayStyle("POWER")).toBe(true);
  expect(isPlayStyle("DUNK")).toBe(false);
  expect(isPlayStyle(null)).toBe(false);
});
