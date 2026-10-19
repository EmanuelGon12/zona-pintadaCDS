import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/cliente";
import { carritoDePrueba, pedidoDePrueba } from "../test/datos";
import { SESION_CLIENTE, renderizar } from "../test/renderizar";
import { PaginaDetallePedido } from "./PaginaDetallePedido";

afterEach(() => vi.restoreAllMocks());

const abrir = (ruta: string) => renderizar(<PaginaDetallePedido />, { ruta, patron: "/pedidos/:orderId", sesion: SESION_CLIENTE });

describe("detalle del pedido", () => {
  it("al volver del pago confirma con la pasarela y limpia la URL", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba({ lines: [], item_count: 0 }));
    const confirmar = vi.spyOn(api, "confirmarPago").mockResolvedValue(pedidoDePrueba({ status: "PAID", paid_at: "2026-10-18T15:05:00Z" }));
    abrir("/pedidos/12?pago=exitoso&collection_id=99");

    expect(await screen.findByText("Pago aprobado.")).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledWith("12");
    expect(screen.getByText("Pagada")).toBeInTheDocument();
    expect(screen.getByTestId("ubicacion")).toHaveTextContent(/^\/pedidos\/12$/);
  });

  it("si el pago todavía no se acreditó deja volver a verificar", async () => {
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue(carritoDePrueba());
    const confirmar = vi
      .spyOn(api, "confirmarPago")
      .mockResolvedValueOnce(pedidoDePrueba())
      .mockResolvedValueOnce(pedidoDePrueba({ status: "PAID" }));
    abrir("/pedidos/12?pago=exitoso");

    expect(await screen.findByText("Estamos confirmando tu pago.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a verificar" }));
    expect(await screen.findByText("Pago aprobado.")).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledTimes(2);
  });

  it("sin venir del pago solo muestra el pedido", async () => {
    const obtener = vi.spyOn(api, "obtenerPedido").mockResolvedValue(pedidoDePrueba({ status: "CANCELLED" }));
    const confirmar = vi.spyOn(api, "confirmarPago");
    abrir("/pedidos/12");

    expect(await screen.findByText(/fue cancelado/)).toBeInTheDocument();
    expect(obtener).toHaveBeenCalledWith("12");
    expect(confirmar).not.toHaveBeenCalled();
  });
});
