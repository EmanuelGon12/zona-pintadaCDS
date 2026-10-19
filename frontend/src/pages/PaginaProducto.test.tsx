import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api/cliente";
import { carritoDePrueba, productoDePrueba } from "../test/datos";
import { SESION_CLIENTE, renderizar } from "../test/renderizar";
import { PaginaProducto } from "./PaginaProducto";

afterEach(() => vi.restoreAllMocks());

const abrir = (opciones = {}) => renderizar(<PaginaProducto />, { ruta: "/producto/2", patron: "/producto/:productId", ...opciones });

describe("ficha de producto", () => {
  it("pide elegir talla antes de agregar", async () => {
    vi.spyOn(api, "obtenerProducto").mockResolvedValue(productoDePrueba());
    const agregar = vi.spyOn(api, "agregarAlCarrito");
    abrir({ sesion: SESION_CLIENTE });

    await userEvent.click(await screen.findByRole("button", { name: "Agregar al carrito" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige una talla para continuar.");
    expect(agregar).not.toHaveBeenCalled();
  });

  it("agrega la talla y cantidad elegidas y actualiza el contador", async () => {
    vi.spyOn(api, "obtenerProducto").mockResolvedValue(productoDePrueba());
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba({ item_count: 0 }));
    const agregar = vi.spyOn(api, "agregarAlCarrito").mockResolvedValue(carritoDePrueba({ item_count: 2 }));
    abrir({ sesion: SESION_CLIENTE });

    await userEvent.click(await screen.findByRole("radio", { name: "10" }));
    await userEvent.selectOptions(screen.getByLabelText("Cantidad"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));

    expect(agregar).toHaveBeenCalledWith(2, "10", 2);
    expect(await screen.findByText("Agregaste talla 10 al carrito.")).toBeInTheDocument();
  });

  it("si no inició sesión lo manda al login y después vuelve al producto", async () => {
    vi.spyOn(api, "obtenerProducto").mockResolvedValue(productoDePrueba());
    abrir();
    await userEvent.click(await screen.findByRole("radio", { name: "9" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/ingresar?volver=%2Fproducto%2F2");
  });

  it("muestra el error de stock que devuelve el backend", async () => {
    vi.spyOn(api, "obtenerProducto").mockResolvedValue(productoDePrueba());
    vi.spyOn(api, "agregarAlCarrito").mockRejectedValue(new ApiError("Solo quedan 1 unidades.", 409));
    abrir({ sesion: SESION_CLIENTE });
    await userEvent.click(await screen.findByRole("radio", { name: "9" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Solo quedan 1 unidades.");
  });

  it("sin stock no deja comprar", async () => {
    vi.spyOn(api, "obtenerProducto").mockResolvedValue(productoDePrueba({ stock: 0 }));
    abrir({ sesion: SESION_CLIENTE });
    expect(await screen.findByRole("button", { name: "Sin stock" })).toBeDisabled();
    expect(screen.queryByLabelText("Cantidad")).not.toBeInTheDocument();
  });

  it("producto que no existe", async () => {
    vi.spyOn(api, "obtenerProducto").mockRejectedValue(new ApiError("No encontramos ese producto.", 404));
    abrir();
    expect(await screen.findByText("No encontramos ese producto.")).toBeInTheDocument();
  });
});
