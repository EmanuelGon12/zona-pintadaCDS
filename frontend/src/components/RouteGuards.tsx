import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { MessagePage } from "./PageStates";

function LoginRedirect() {
  const location = useLocation();
  const { lastSignOutReason } = useSession();
  if (lastSignOutReason === "manual") return <Navigate to="/" replace />;
  const returnPath = encodeURIComponent(`${location.pathname}${location.search}`);
  return <Navigate to={`/ingresar?volver=${returnPath}`} replace />;
}

export function RequireAuthentication({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession();
  return isAuthenticated ? <>{children}</> : <LoginRedirect />;
}

export function RequireAdministrator({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdministrator } = useSession();
  if (!isAuthenticated) return <LoginRedirect />;
  if (!isAdministrator) {
    return (
      <MessagePage title="Sin acceso">
        <p>Esta sección es solo para administradores.</p>
      </MessagePage>
    );
  }
  return <>{children}</>;
}
