import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/cliente";
import { productoDePrueba } from "../test/datos";
import { renderizar } from "../test/renderizar";
import { PaginaCatalogo, PaginaNovedades } from "./PaginaCatalogo";

afterEach(() => vi.restoreAllMocks());

describe("catálogo", () => {
  it("lee los filtros de la URL y se los pasa a la API", async () => {
    const listar = vi.spyOn(api, "listarProductos").mockResolvedValue([productoDePrueba()]);
    renderizar(<PaginaCatalogo />, { ruta: "/modelos?estilo=POWER&orden=precio-asc", patron: "/modelos" });

    expect(await screen.findByText("Modelos de potencia")).toBeInTheDocument();
    expect(listar).toHaveBeenCalledWith({ search: "", playStyle: "POWER", order: "precio-asc" });
    expect(screen.getByRole("link", { name: "Potencia" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("1 modelo")).toBeInTheDocument();
  });

  it("ignora filtros inválidos en la URL", async () => {
    const listar = vi.spyOn(api, "listarProductos").mockResolvedValue([]);
    renderizar(<PaginaCatalogo />, { ruta: "/modelos?estilo=DUNK&orden=raro", patron: "/modelos" });
    expect(await screen.findByText("No encontramos modelos con esos filtros.")).toBeInTheDocument();
    expect(listar).toHaveBeenCalledWith({ search: "", playStyle: "", order: "nuevos" });
  });

  it("cambiar el orden actualiza la URL", async () => {
    vi.spyOn(api, "listarProductos").mockResolvedValue([productoDePrueba()]);
    renderizar(<PaginaCatalogo />, { ruta: "/modelos?q=negra", patron: "/modelos" });
    await userEvent.selectOptions(await screen.findByLabelText("Ordenar por"), "precio-desc");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/modelos?q=negra&orden=precio-desc");
  });

  it("novedades muestra solo los modelos nuevos", async () => {
    vi.spyOn(api, "listarProductos").mockResolvedValue([
      productoDePrueba({ id: 1, name: "Recién llegada", is_new: true }),
      productoDePrueba({ id: 2, name: "De la temporada pasada", is_new: false }),
    ]);
    renderizar(<PaginaNovedades />, { ruta: "/novedades" });
    expect(await screen.findByText("Recién llegada")).toBeInTheDocument();
    expect(screen.queryByText("De la temporada pasada")).not.toBeInTheDocument();
  });
});
