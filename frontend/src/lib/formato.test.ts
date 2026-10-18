import { describe, expect, it } from "vitest";
import { dolaresACentavos, formatearVencimiento, formatearTarjeta, numeroDePedido } from "./formato";

describe("dolaresACentavos", () => {
  it("convierte montos con punto o coma decimal", () => {
    expect(dolaresACentavos("129.90")).toBe(12990);
    expect(dolaresACentavos("129,9")).toBe(12990);
    expect(dolaresACentavos("80")).toBe(8000);
  });

  it("rechaza montos inválidos", () => {
    expect(dolaresACentavos("")).toBeNull();
    expect(dolaresACentavos("12.345")).toBeNull();
    expect(dolaresACentavos("-5")).toBeNull();
    expect(dolaresACentavos("diez")).toBeNull();
  });
});

describe("formato de tarjeta", () => {
  it("agrupa el número de a cuatro dígitos y descarta lo que no es número", () => {
    expect(formatearTarjeta("4242a4242424242424299")).toBe("4242 4242 4242 4242");
  });

  it("arma el vencimiento como MM / AA", () => {
    expect(formatearVencimiento("1229")).toBe("12 / 29");
    expect(formatearVencimiento("1")).toBe("1");
  });
});

it("completa el número de pedido con ceros", () => {
  expect(numeroDePedido(42)).toBe("N.º 00042");
});
