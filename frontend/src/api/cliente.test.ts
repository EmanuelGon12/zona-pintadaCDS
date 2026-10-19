import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, alExpirarSesion, api } from "./cliente";

function respuestaJson(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  alExpirarSesion(null);
});

describe("cliente de la API", () => {
  it("manda el token guardado en cada pedido", async () => {
    localStorage.setItem("zona-pintada.session", JSON.stringify({ access_token: "abc", user: {} }));
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockResolvedValue(respuestaJson({ lines: [] }));

    await api.obtenerCarrito();

    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/cart");
    expect((opciones?.headers as Record<string, string>).Authorization).toBe("Bearer abc");
  });

  it("arma los filtros del catálogo en la URL", async () => {
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockResolvedValue(respuestaJson([]));
    await api.listarProductos({ search: "alta negra", playStyle: "POWER", order: "precio-asc", limit: 4 });
    const url = new URL(String(fetchFalso.mock.calls[0][0]), "http://tienda");
    expect(Object.fromEntries(url.searchParams)).toEqual({ orden: "precio-asc", q: "alta negra", estilo: "POWER", limite: "4" });
  });

  it("convierte el detalle del backend en un error legible", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(respuestaJson({ detail: "Solo quedan 2 unidades." }, 409));
    await expect(api.agregarAlCarrito(1, "9", 5)).rejects.toMatchObject({ message: "Solo quedan 2 unidades.", status: 409 });
  });

  it("da un mensaje genérico si el servidor no responde JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>error</html>", { status: 500 }));
    await expect(api.listarPedidos()).rejects.toMatchObject({ message: "Ocurrió un error inesperado.", status: 500 });
  });

  it("avisa cuando no hay conexión", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await api.listarProductos().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
  });

  it("si el token venció avisa para cerrar la sesión", async () => {
    localStorage.setItem("zona-pintada.session", JSON.stringify({ access_token: "vencido", user: {} }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(respuestaJson({ detail: "Tienes que iniciar sesión" }, 401));
    const alVencer = vi.fn();
    alExpirarSesion(alVencer);

    await api.listarPedidos().catch(() => null);
    expect(alVencer).toHaveBeenCalledOnce();
  });

  it("un 401 sin sesión (login fallido) no cierra nada", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(respuestaJson({ detail: "Email o contraseña incorrectos." }, 401));
    const alVencer = vi.fn();
    alExpirarSesion(alVencer);

    await expect(api.ingresar({ email: "a@a.com", password: "x" })).rejects.toThrow("Email o contraseña incorrectos.");
    expect(alVencer).not.toHaveBeenCalled();
  });

  it("sube la imagen como formulario sin forzar el Content-Type", async () => {
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockResolvedValue(respuestaJson({ id: 3 }));
    await api.subirImagen(3, new File(["png"], "foto.png", { type: "image/png" }));
    const opciones = fetchFalso.mock.calls[0][1]!;
    expect(opciones.body).toBeInstanceOf(FormData);
    expect((opciones.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});
