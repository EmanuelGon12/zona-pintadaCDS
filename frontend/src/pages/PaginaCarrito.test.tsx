import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api/cliente";
import { carritoDePrueba } from "../test/datos";
import { SESION_CLIENTE, renderizar } from "../test/renderizar";
import { PaginaCarrito } from "./PaginaCarrito";

afterEach(() => vi.restoreAllMocks());

const sinEspacioDuro = (texto: string | null) => (texto ?? "").replace(/ /g, " ");

describe("carrito", () => {
  it("muestra las líneas y los totales que calcula el backend", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba());
    renderizar(<PaginaCarrito />, { sesion: SESION_CLIENTE, ruta: "/carrito" });

    const resumen = await screen.findByRole("complementary");
    expect(sinEspacioDuro(resumen.textContent)).toContain("$ 5.480");
    expect(sinEspacioDuro(resumen.textContent)).toContain("Suma $ 810 más y el envío es gratis.");
    expect(screen.getByText("Zapatilla de básquetbol corte medio blanca y roja")).toBeInTheDocument();
  });

  it("cambiar la cantidad usa la respuesta del backend", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba());
    const conDos = carritoDePrueba({ item_count: 2, subtotal_cents: 1038000, shipping_cents: 0, total_cents: 1038000 });
    conDos.lines[0] = { ...conDos.lines[0], quantity: 2, line_total_cents: 1038000 };
    const cambiar = vi.spyOn(api, "cambiarCantidad").mockResolvedValue(conDos);
    renderizar(<PaginaCarrito />, { sesion: SESION_CLIENTE, ruta: "/carrito" });

    await userEvent.click(await screen.findByRole("button", { name: "Agregar una unidad" }));

    expect(cambiar).toHaveBeenCalledWith(11, 2);
    const resumen = screen.getByRole("complementary");
    expect(within(resumen).getByText("Gratis")).toBeInTheDocument();
  });

  it("si una línea tiene problemas no deja pagar", async () => {
    const conProblema = carritoDePrueba({ can_checkout: false });
    conProblema.lines[0] = { ...conProblema.lines[0], is_purchasable: false, problem: "Solo quedan 0 unidades." };
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(conProblema);
    renderizar(<PaginaCarrito />, { sesion: SESION_CLIENTE, ruta: "/carrito" });

    expect(await screen.findByText("Solo quedan 0 unidades.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a pagar" })).toBeDisabled();
  });

  it("muestra el error si el pago no se pudo iniciar", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba());
    vi.spyOn(api, "iniciarPago").mockRejectedValue(new ApiError("Zapatilla: se agotó mientras comprabas.", 409));
    renderizar(<PaginaCarrito />, { sesion: SESION_CLIENTE, ruta: "/carrito" });

    await userEvent.click(await screen.findByRole("button", { name: "Ir a pagar" }));

    expect(await screen.findByText("Zapatilla: se agotó mientras comprabas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a pagar" })).toBeEnabled();
  });

  it("con la pasarela simulada navega dentro de la tienda", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba());
    vi.spyOn(api, "iniciarPago").mockResolvedValue({ order_id: 5, checkout_url: "/pago-simulado/5" });
    renderizar(<PaginaCarrito />, { sesion: SESION_CLIENTE, ruta: "/carrito" });

    await userEvent.click(await screen.findByRole("button", { name: "Ir a pagar" }));
    expect(await screen.findByTestId("ubicacion")).toHaveTextContent("/pago-simulado/5");
  });

  it("al volver de un pago cancelado libera la orden y avisa", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba());
    const abandonar = vi.spyOn(api, "abandonarPago").mockResolvedValue({} as never);
    renderizar(<PaginaCarrito />, { sesion: SESION_CLIENTE, ruta: "/carrito?pago=cancelado&orden=8" });

    expect(await screen.findByText("Cancelaste el pago. Tu carrito sigue como lo dejaste.")).toBeInTheDocument();
    expect(abandonar).toHaveBeenCalledOnce();
    expect(abandonar).toHaveBeenCalledWith("8");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent(/^\/carrito$/);
  });

  it("carrito vacío", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba({ lines: [], item_count: 0 }));
    renderizar(<PaginaCarrito />, { sesion: SESION_CLIENTE, ruta: "/carrito" });
    expect(await screen.findByText("Todavía no agregaste nada.")).toBeInTheDocument();
  });
});
