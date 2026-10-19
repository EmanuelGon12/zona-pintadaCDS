import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/cliente";
import { productoDePrueba } from "../test/datos";
import { renderizar } from "../test/renderizar";
import { SelectorEstilo } from "./SelectorEstilo";

afterEach(() => vi.restoreAllMocks());

describe("selector por estilo de juego", () => {
  it("guía paso a paso y recomienda según estilo y superficie", async () => {
    const recomendar = vi.spyOn(api, "recomendarProductos").mockResolvedValue([
      { product: productoDePrueba({ id: 8, name: "Corte alto celeste", play_style: "POWER", surface: "OUTDOOR" }), matches_surface: true },
      { product: productoDePrueba({ id: 3, name: "Corte alto negra", play_style: "POWER", surface: "INDOOR" }), matches_surface: false },
    ]);
    renderizar(<SelectorEstilo />);

    expect(screen.getByText("Elige tu estilo de juego para empezar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Potencia/ }));
    expect(screen.getByText("Ahora dinos dónde juegas.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Exterior/ }));

    expect(recomendar).toHaveBeenCalledWith("POWER", "OUTDOOR");
    expect(await screen.findByText("Para tu juego de potencia")).toBeInTheDocument();
    expect(screen.getByText("Apta para exterior.")).toBeInTheDocument();
    expect(screen.getByText("Va con tu estilo, aunque no es la más indicada para esa superficie.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos los de potencia" })).toHaveAttribute("href", "/modelos?estilo=POWER");
  });

  it("avisa si no hay stock para esa combinación", async () => {
    vi.spyOn(api, "recomendarProductos").mockResolvedValue([]);
    renderizar(<SelectorEstilo />);
    await userEvent.click(screen.getByRole("radio", { name: /Velocidad/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Cancha cubierta/ }));
    expect(await screen.findByText(/no tenemos stock para esa combinación/)).toBeInTheDocument();
  });
});
