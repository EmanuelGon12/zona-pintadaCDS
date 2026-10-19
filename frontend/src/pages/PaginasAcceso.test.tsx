import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api/cliente";
import { SESION_CLIENTE, renderizar } from "../test/renderizar";
import { PaginaIngreso, PaginaRegistro } from "./PaginasAcceso";

afterEach(() => vi.restoreAllMocks());

describe("ingreso", () => {
  it("guarda la sesión y vuelve a la página que pidió el login", async () => {
    const ingresar = vi.spyOn(api, "ingresar").mockResolvedValue(SESION_CLIENTE);
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue({ item_count: 0 } as never);
    renderizar(<PaginaIngreso />, { ruta: "/ingresar?volver=%2Fcarrito" });

    await userEvent.type(screen.getByLabelText("Email"), "cliente@correo.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(ingresar).toHaveBeenCalledWith({ email: "cliente@correo.com", password: "clave-segura" });
    expect(await screen.findByTestId("ubicacion")).toHaveTextContent("/carrito");
    expect(JSON.parse(localStorage.getItem("zona-pintada.usuario")!).email).toBe("cliente@correo.com");
    expect(await screen.findByText("Hola, Lucía.")).toBeInTheDocument();
  });

  it("muestra el error del backend y deja reintentar", async () => {
    vi.spyOn(api, "ingresar").mockRejectedValue(new ApiError("Email o contraseña incorrectos.", 401));
    renderizar(<PaginaIngreso />, { ruta: "/ingresar" });

    await userEvent.type(screen.getByLabelText("Email"), "cliente@correo.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos.");
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(localStorage.getItem("zona-pintada.usuario")).toBeNull();
  });

  it("no vuelve a sitios externos aunque lo pidan en la URL", async () => {
    vi.spyOn(api, "ingresar").mockResolvedValue(SESION_CLIENTE);
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue({ item_count: 0 } as never);
    renderizar(<PaginaIngreso />, { ruta: "/ingresar?volver=%2F%2Fsitio-malo.com" });

    await userEvent.type(screen.getByLabelText("Email"), "cliente@correo.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByTestId("ubicacion")).toHaveTextContent(/^\/$/);
  });
});

describe("registro", () => {
  it("crea la cuenta con los datos del formulario", async () => {
    const registrarse = vi.spyOn(api, "registrarse").mockResolvedValue(SESION_CLIENTE);
    vi.spyOn(api, "obtenerCarrito").mockResolvedValue({ item_count: 0 } as never);
    renderizar(<PaginaRegistro />, { ruta: "/registro" });

    await userEvent.type(screen.getByLabelText("Nombre y apellido"), "Lucía Pereira");
    await userEvent.type(screen.getByLabelText("Email"), "lucia@correo.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(registrarse).toHaveBeenCalledWith({ full_name: "Lucía Pereira", email: "lucia@correo.com", password: "clave-segura" });
    expect(await screen.findByText("Tu cuenta está lista.")).toBeInTheDocument();
  });
});
