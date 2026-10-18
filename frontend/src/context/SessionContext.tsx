import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { onUnauthorized } from "../api/client";
import { readStoredSession, storeSession } from "../api/sessionStorage";
import type { Session, User } from "../api/types";

type SignOutReason = "manual" | "expired";

interface SessionContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdministrator: boolean;
  lastSignOutReason: SignOutReason | null;
  signIn: (session: Session) => void;
  signOut: (reason?: SignOutReason) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const [lastSignOutReason, setLastSignOutReason] = useState<SignOutReason | null>(null);
  const navigate = useNavigate();

  const signIn = useCallback((newSession: Session) => {
    storeSession(newSession);
    setSession(newSession);
    setLastSignOutReason(null);
  }, []);

  const signOut = useCallback((reason: SignOutReason = "manual") => {
    storeSession(null);
    setSession(null);
    setLastSignOutReason(reason);
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      signOut("expired");
      navigate("/ingresar");
    });
    return () => onUnauthorized(null);
  }, [navigate, signOut]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isAdministrator: session?.user.role === "ADMIN",
      lastSignOutReason,
      signIn,
      signOut,
    }),
    [session, lastSignOutReason, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession debe usarse dentro de SessionProvider");
  return context;
}
