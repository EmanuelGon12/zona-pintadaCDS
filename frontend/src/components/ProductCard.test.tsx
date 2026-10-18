import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Product } from "../api/types";
import { ProductCard } from "./ProductCard";

const baseProduct: Product = {
  id: 7,
  name: "Zapatilla de básquetbol corte alto blanca",
  colorway: "Blanco",
  description: "",
  price_cents: 11900,
  stock: 10,
  available_sizes: ["9"],
  image_url: null,
  play_style: "POWER",
  surface: "BOTH",
  is_new: false,
  created_at: "2026-10-01T00:00:00Z",
  is_active: true,
};

function renderCard(overrides: Partial<Product> = {}) {
  return render(
    <MemoryRouter>
      <ProductCard product={{ ...baseProduct, ...overrides }} />
    </MemoryRouter>
  );
}

describe("ProductCard", () => {
  it("muestra nombre, estilo y enlace al detalle", () => {
    renderCard();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/producto/7");
    expect(screen.getByText("Potencia")).toBeInTheDocument();
    expect(screen.getByText(baseProduct.name)).toBeInTheDocument();
  });

  it("marca los modelos nuevos", () => {
    renderCard({ is_new: true });
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("prioriza el aviso de agotado sobre el de nuevo", () => {
    renderCard({ is_new: true, stock: 0 });
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
  });
});
