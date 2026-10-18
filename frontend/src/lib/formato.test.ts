import { describe, expect, it } from "vitest";
import { formatearPrecio, formatearTarjeta, formatearVencimiento, numeroDePedido, pesosACentavos } from "./formato";

describe("pesosACentavos", () => {
  it("entiende el punto de miles y la coma decimal", () => {
    expect(pesosACentavos("5190")).toBe(519000);
    expect(pesosACentavos("5.190")).toBe(519000);
    expect(pesosACentavos("5.190,50")).toBe(519050);
    expect(pesosACentavos("5190,5")).toBe(519050);
    expect(pesosACentavos("129.90")).toBe(12990);
  });

  it("rechaza montos inválidos", () => {
    expect(pesosACentavos("")).toBeNull();
    expect(pesosACentavos("12,345")).toBeNull();
    expect(pesosACentavos("-5")).toBeNull();
    expect(pesosACentavos("diez")).toBeNull();
  });
});

it("muestra los precios en pesos uruguayos", () => {
  // Intl pone un espacio duro entre el signo y el numero
  const sinEspacioDuro = (texto: string) => texto.replace(/\u00a0/g, " ");
  expect(sinEspacioDuro(formatearPrecio(519000))).toBe("$ 5.190");
  expect(sinEspacioDuro(formatearPrecio(519050))).toBe("$ 5.190,50");
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
