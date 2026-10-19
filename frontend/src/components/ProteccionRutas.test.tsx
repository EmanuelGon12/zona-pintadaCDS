import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SESION_ADMIN, SESION_CLIENTE, renderizar } from "../test/renderizar";
import { SoloAdmin, SoloLogueados } from "./ProteccionRutas";

describe("protección de rutas", () => {
  it("manda al login guardando a dónde quería ir", () => {
    renderizar(<SoloLogueados><p>Mis pedidos</p></SoloLogueados>, { ruta: "/pedidos?pagina=2" });
    expect(screen.queryByText("Mis pedidos")).not.toBeInTheDocument();
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/ingresar?volver=%2Fpedidos%3Fpagina%3D2");
  });

  it("deja pasar a un usuario logueado", () => {
    renderizar(<SoloLogueados><p>Mis pedidos</p></SoloLogueados>, { sesion: SESION_CLIENTE });
    expect(screen.getByText("Mis pedidos")).toBeInTheDocument();
  });

  it("un cliente no ve el panel de administración", () => {
    renderizar(<SoloAdmin><p>Panel</p></SoloAdmin>, { sesion: SESION_CLIENTE });
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("un admin sí lo ve", () => {
    renderizar(<SoloAdmin><p>Panel</p></SoloAdmin>, { sesion: SESION_ADMIN });
    expect(screen.getByText("Panel")).toBeInTheDocument();
  });
});
