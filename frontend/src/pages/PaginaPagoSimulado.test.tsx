import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api/cliente";
import { pedidoDePrueba } from "../test/datos";
import { SESION_CLIENTE, renderizar } from "../test/renderizar";
import { PaginaPagoSimulado } from "./PaginaPagoSimulado";

afterEach(() => vi.restoreAllMocks());

const abrir = () => renderizar(<PaginaPagoSimulado />, { ruta: "/pago-simulado/12", patron: "/pago-simulado/:orderId", sesion: SESION_CLIENTE });

describe("pasarela simulada", () => {
  it("formatea la tarjeta y al aprobar va al pedido", async () => {
    vi.spyOn(api, "obtenerPedido").mockResolvedValue(pedidoDePrueba());
    const pagar = vi.spyOn(api, "pagarSimulado").mockResolvedValue(pedidoDePrueba({ status: "PAID" }));
    abrir();

    const tarjeta = await screen.findByLabelText("Número de tarjeta");
    await userEvent.type(tarjeta, "4242424242424242");
    expect(tarjeta).toHaveValue("4242 4242 4242 4242");
    await userEvent.click(screen.getByRole("button", { name: /^Pagar/ }));

    expect(pagar).toHaveBeenCalledWith(12, "4242 4242 4242 4242");
    expect(await screen.findByTestId("ubicacion")).toHaveTextContent("/pedidos/12?pago=exitoso");
  });

  it("si el banco rechaza muestra el motivo", async () => {
    vi.spyOn(api, "obtenerPedido").mockResolvedValue(pedidoDePrueba());
    vi.spyOn(api, "pagarSimulado").mockRejectedValue(new ApiError("El banco rechazó la tarjeta.", 402));
    abrir();

    await userEvent.type(await screen.findByLabelText("Número de tarjeta"), "4000000000000002");
    await userEvent.click(screen.getByRole("button", { name: /^Pagar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El banco rechazó la tarjeta.");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/pago-simulado/12");
  });

  it("una orden ya pagada no se puede volver a pagar", async () => {
    vi.spyOn(api, "obtenerPedido").mockResolvedValue(pedidoDePrueba({ status: "PAID" }));
    abrir();
    await waitFor(() => expect(screen.getByTestId("ubicacion")).toHaveTextContent(/^\/pedidos\/12$/));
  });
});
