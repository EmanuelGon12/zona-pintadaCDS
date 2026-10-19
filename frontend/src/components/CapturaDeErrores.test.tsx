import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapturaDeErrores } from "./CapturaDeErrores";

function PaginaRota(): never {
  throw new Error("se rompio el render");
}

afterEach(() => vi.restoreAllMocks());

describe("captura de errores", () => {
  it("muestra un mensaje en lugar de dejar la pantalla en blanco", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<CapturaDeErrores clave="/rota"><PaginaRota /></CapturaDeErrores>);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
    expect(screen.getByRole("button", { name: "Recargar" })).toBeInTheDocument();
  });

  it("al cambiar de página se recupera", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = render(<CapturaDeErrores clave="/rota"><PaginaRota /></CapturaDeErrores>);
    rerender(<CapturaDeErrores clave="/modelos"><p>Catálogo</p></CapturaDeErrores>);
    expect(screen.getByText("Catálogo")).toBeInTheDocument();
  });
});
