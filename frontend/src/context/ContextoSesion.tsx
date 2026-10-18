import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { alExpirarSesion } from "../api/cliente";
import { leerSesionGuardada, guardarSesionLocal } from "../api/sesionGuardada";
import type { Session, User } from "../api/tipos";

// "manual" = apreto salir, "expired" = el token vencio. Sirve para saber a donde mandarlo despues
type SignOutReason = "manual" | "expired";

interface SessionContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdministrator: boolean;
  lastSignOutReason: SignOutReason | null;
  guardarSesion: (session: Session) => void;
  cerrarSesion: (reason?: SignOutReason) => void;
}

const ContextoSesion = createContext<SessionContextValue | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(leerSesionGuardada);
  const [lastSignOutReason, setLastSignOutReason] = useState<SignOutReason | null>(null);
  const navigate = useNavigate();

  const guardarSesion = useCallback((newSession: Session) => {
    guardarSesionLocal(newSession);
    setSession(newSession);
    setLastSignOutReason(null);
  }, []);

  const cerrarSesion = useCallback((reason: SignOutReason = "manual") => {
    guardarSesionLocal(null);
    setSession(null);
    setLastSignOutReason(reason);
  }, []);

  useEffect(() => {
    alExpirarSesion(() => {
      cerrarSesion("expired");
      navigate("/ingresar");
    });
    return () => alExpirarSesion(null);
  }, [navigate, cerrarSesion]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isAdministrator: session?.user.role === "ADMIN",
      lastSignOutReason,
      guardarSesion,
      cerrarSesion,
    }),
    [session, lastSignOutReason, guardarSesion, cerrarSesion]
  );

  return <ContextoSesion.Provider value={value}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): SessionContextValue {
  const context = useContext(ContextoSesion);
  if (!context) throw new Error("useSesion debe usarse dentro de ProveedorSesion");
  return context;
}
