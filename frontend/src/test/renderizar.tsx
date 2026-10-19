import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Session } from "../api/tipos";
import { ProveedorAvisos } from "../context/ContextoAvisos";
import { ProveedorCarrito } from "../context/ContextoCarrito";
import { ProveedorSesion } from "../context/ContextoSesion";

export const SESION_CLIENTE: Session = {
  access_token: "token-cliente",
  token_type: "bearer",
  user: { id: 1, email: "cliente@correo.com", full_name: "Lucía Pereira", role: "CUSTOMER" },
};

export const SESION_ADMIN: Session = {
  access_token: "token-admin",
  token_type: "bearer",
  user: { id: 2, email: "admin@correo.com", full_name: "Admin", role: "ADMIN" },
};

// muestra la ruta actual para poder chequear redirecciones
export function UbicacionActual() {
  const location = useLocation();
  return <output data-testid="ubicacion">{location.pathname + location.search}</output>;
}

interface Opciones {
  ruta?: string;
  patron?: string;
  sesion?: Session | null;
}

export function renderizar(ui: ReactElement, { ruta = "/", patron, sesion = null }: Opciones = {}) {
  // la pagina se monta solo en su ruta, asi una redireccion no la vuelve a montar (y no queda en bucle)
  const rutaDeLaPagina = patron ?? ruta.split("?")[0];
  localStorage.clear();
  if (sesion) localStorage.setItem("zona-pintada.session", JSON.stringify(sesion));
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAvisos>
        <ProveedorSesion>
          <ProveedorCarrito>
            <Routes>
              <Route path={rutaDeLaPagina} element={ui} />
              <Route path="*" element={null} />
            </Routes>
            <UbicacionActual />
          </ProveedorCarrito>
        </ProveedorSesion>
      </ProveedorAvisos>
    </MemoryRouter>
  );
}
