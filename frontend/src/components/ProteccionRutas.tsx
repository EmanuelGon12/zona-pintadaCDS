import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSesion } from "../context/ContextoSesion";
import { PaginaMensaje } from "./EstadosDePagina";

function RedirigirAlLogin() {
  const location = useLocation();
  const { lastSignOutReason } = useSesion();
  // si recien cerro sesion no tiene sentido mandarlo al login, va a la home
  if (lastSignOutReason === "manual") return <Navigate to="/" replace />;
  const returnPath = encodeURIComponent(`${location.pathname}${location.search}`);
  return <Navigate to={`/ingresar?volver=${returnPath}`} replace />;
}

export function SoloLogueados({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSesion();
  return isAuthenticated ? <>{children}</> : <RedirigirAlLogin />;
}

export function SoloAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdministrator } = useSesion();
  if (!isAuthenticated) return <RedirigirAlLogin />;
  if (!isAdministrator) {
    return (
      <PaginaMensaje title="Sin acceso">
        <p>Esta sección es solo para administradores.</p>
      </PaginaMensaje>
    );
  }
  return <>{children}</>;
}
