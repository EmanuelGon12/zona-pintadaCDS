import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { alExpirarSesion, api } from "../api/cliente";
import { guardarUsuarioLocal, leerUsuarioGuardado } from "../api/sesionGuardada";
import type { Session, User } from "../api/tipos";

// "manual" = apreto salir, "expired" = el token vencio. Sirve para saber a donde mandarlo despues
type SignOutReason = "manual" | "expired";

interface SessionContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdministrator: boolean;
  verificando: boolean;
  lastSignOutReason: SignOutReason | null;
  guardarSesion: (session: Session) => void;
  cerrarSesion: (reason?: SignOutReason) => void;
}

const ContextoSesion = createContext<SessionContextValue | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  // arranco con lo que habia guardado para no mostrar "Ingresar" un segundo, y despues confirmo con el backend
  const [user, setUser] = useState<User | null>(leerUsuarioGuardado);
  const [verificando, setVerificando] = useState(true);
  const [lastSignOutReason, setLastSignOutReason] = useState<SignOutReason | null>(null);
  const navigate = useNavigate();

  const guardarSesion = useCallback((session: Session) => {
    guardarUsuarioLocal(session.user);
    setUser(session.user);
    setLastSignOutReason(null);
  }, []);

  const cerrarSesion = useCallback((reason: SignOutReason = "manual") => {
    // si salio a mano le pido al backend que borre la cookie; si vencio ya no sirve igual
    if (reason === "manual") api.salir().catch(() => null);
    guardarUsuarioLocal(null);
    setUser(null);
    setLastSignOutReason(reason);
  }, []);

  useEffect(() => {
    let sigueMontado = true;
    api.usuarioActual().then(
      (usuario) => {
        if (!sigueMontado) return;
        guardarUsuarioLocal(usuario);
        setUser(usuario);
      },
      () => {
        if (!sigueMontado) return;
        guardarUsuarioLocal(null);
        setUser(null);
      }
    ).finally(() => sigueMontado && setVerificando(false));
    return () => {
      sigueMontado = false;
    };
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
      user,
      isAuthenticated: user !== null,
      isAdministrator: user?.role === "ADMIN",
      verificando,
      lastSignOutReason,
      guardarSesion,
      cerrarSesion,
    }),
    [user, verificando, lastSignOutReason, guardarSesion, cerrarSesion]
  );

  return <ContextoSesion.Provider value={value}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): SessionContextValue {
  const context = useContext(ContextoSesion);
  if (!context) throw new Error("useSesion debe usarse dentro de ProveedorSesion");
  return context;
}
