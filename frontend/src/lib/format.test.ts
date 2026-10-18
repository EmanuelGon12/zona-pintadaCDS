import { describe, expect, it } from "vitest";
import { dollarsToCents, formatCardExpiry, formatCardNumber, formatOrderNumber } from "./format";

describe("dollarsToCents", () => {
  it("convierte montos con punto o coma decimal", () => {
    expect(dollarsToCents("129.90")).toBe(12990);
    expect(dollarsToCents("129,9")).toBe(12990);
    expect(dollarsToCents("80")).toBe(8000);
  });

  it("rechaza montos inválidos", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("12.345")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
    expect(dollarsToCents("diez")).toBeNull();
  });
});

describe("formato de tarjeta", () => {
  it("agrupa el número de a cuatro dígitos y descarta lo que no es número", () => {
    expect(formatCardNumber("4242a4242424242424299")).toBe("4242 4242 4242 4242");
  });

  it("arma el vencimiento como MM / AA", () => {
    expect(formatCardExpiry("1229")).toBe("12 / 29");
    expect(formatCardExpiry("1")).toBe("1");
  });
});

it("completa el número de pedido con ceros", () => {
  expect(formatOrderNumber(42)).toBe("N.º 00042");
});
