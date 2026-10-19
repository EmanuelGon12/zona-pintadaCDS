import { describe, expect, it } from "vitest";
import { rutaCatalogo, rutaDeVueltaSegura } from "./rutaCatalogo";

describe("rutaCatalogo", () => {
  it("omite los filtros vacíos y el orden por defecto", () => {
    expect(rutaCatalogo({})).toBe("/modelos");
    expect(rutaCatalogo({ order: "nuevos" })).toBe("/modelos");
    expect(rutaCatalogo({ search: "negra", playStyle: "SPEED", order: "precio-desc" })).toBe("/modelos?q=negra&estilo=SPEED&orden=precio-desc");
  });
});

describe("rutaDeVueltaSegura", () => {
  it("acepta solo rutas internas", () => {
    expect(rutaDeVueltaSegura("/carrito")).toBe("/carrito");
    expect(rutaDeVueltaSegura("//sitio-malo.com")).toBe("/");
    expect(rutaDeVueltaSegura("https://sitio-malo.com")).toBe("/");
    expect(rutaDeVueltaSegura(null)).toBe("/");
  });
});
