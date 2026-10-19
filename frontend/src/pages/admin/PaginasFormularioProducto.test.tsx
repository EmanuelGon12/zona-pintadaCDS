import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/cliente";
import { productoDePrueba } from "../../test/datos";
import { SESION_ADMIN, renderizar } from "../../test/renderizar";
import { PaginaNuevoProducto } from "./PaginasFormularioProducto";

afterEach(() => vi.restoreAllMocks());

async function completarFormulario(precio: string) {
  await userEvent.type(screen.getByLabelText("Nombre"), "Zapatilla nueva");
  await userEvent.clear(screen.getByLabelText("Precio ($)"));
  if (precio) await userEvent.type(screen.getByLabelText("Precio ($)"), precio);
}

describe("formulario de producto del admin", () => {
  it("crea el producto con el precio convertido a centavos", async () => {
    const crear = vi.spyOn(api, "crearProducto").mockResolvedValue(productoDePrueba({ id: 20 }));
    renderizar(<PaginaNuevoProducto />, { sesion: SESION_ADMIN, ruta: "/admin/productos/nuevo" });

    await completarFormulario("5.190");
    await userEvent.click(screen.getByRole("button", { name: "Crear producto" }));

    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ name: "Zapatilla nueva", price_cents: 519000, available_sizes: ["8", "9", "10", "11"] }));
    expect(await screen.findByTestId("ubicacion")).toHaveTextContent("/admin");
  });

  it("no manda nada si el precio es inválido", async () => {
    const crear = vi.spyOn(api, "crearProducto");
    renderizar(<PaginaNuevoProducto />, { sesion: SESION_ADMIN, ruta: "/admin/productos/nuevo" });

    await completarFormulario("diez");
    await userEvent.click(screen.getByRole("button", { name: "Crear producto" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Ingresa un precio válido");
    expect(crear).not.toHaveBeenCalled();
  });

  it("exige al menos una talla", async () => {
    renderizar(<PaginaNuevoProducto />, { sesion: SESION_ADMIN, ruta: "/admin/productos/nuevo" });
    await completarFormulario("5190");
    for (const talla of ["8", "9", "10", "11"]) {
      await userEvent.click(screen.getByRole("checkbox", { name: talla }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Crear producto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige al menos una talla.");
  });

  it("rechaza archivos que no son imágenes antes de subirlos", async () => {
    renderizar(<PaginaNuevoProducto />, { sesion: SESION_ADMIN, ruta: "/admin/productos/nuevo" });
    const archivo = new File(["<svg/>"], "dibujo.svg", { type: "image/svg+xml" });
    fireEvent.change(screen.getByLabelText("Imagen"), { target: { files: [archivo] } });
    expect(screen.getByRole("alert")).toHaveTextContent("La imagen debe ser JPG, PNG o WebP.");
  });
});
