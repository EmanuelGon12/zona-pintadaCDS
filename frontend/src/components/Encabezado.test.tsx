import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/cliente";
import { carritoDePrueba } from "../test/datos";
import { SESION_ADMIN, SESION_CLIENTE, renderizar } from "../test/renderizar";
import { Encabezado } from "./Encabezado";

afterEach(() => vi.restoreAllMocks());

describe("encabezado", () => {
  it("buscar lleva al catálogo con el término", async () => {
    renderizar(<Encabezado />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar modelos" }), "corte alto{Enter}");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/modelos?q=corte%20alto");
  });

  it("muestra el contador del carrito del usuario", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba({ item_count: 3 }));
    renderizar(<Encabezado />, { sesion: SESION_CLIENTE });
    expect(await screen.findByRole("link", { name: "Carrito, 3 productos" })).toBeInTheDocument();
    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  });

  it("el admin ve el acceso al panel", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba({ item_count: 0 }));
    renderizar(<Encabezado />, { sesion: SESION_ADMIN });
    expect(await screen.findByRole("link", { name: "Administración" })).toHaveAttribute("href", "/admin");
  });

  it("salir borra la sesión", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba({ item_count: 1 }));
    renderizar(<Encabezado />, { sesion: SESION_CLIENTE });
    await userEvent.click(await screen.findByRole("button", { name: "Salir" }));
    expect(localStorage.getItem("zona-pintada.session")).toBeNull();
    expect(await screen.findByText("Cerraste sesión.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar" })).toBeInTheDocument();
  });
});
