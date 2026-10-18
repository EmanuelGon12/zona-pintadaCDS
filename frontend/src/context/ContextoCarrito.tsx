import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/cliente";
import { useSesion } from "./ContextoSesion";

interface CartContextValue {
  itemCount: number;
  actualizarContador: (count: number) => void;
  refrescarContador: () => Promise<void>;
}

const ContextoCarrito = createContext<CartContextValue | null>(null);

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSesion();
  const [itemCount, actualizarContador] = useState(0);

  const refrescarContador = useCallback(async () => {
    if (!isAuthenticated) {
      actualizarContador(0);
      return;
    }
    try {
      const cart = await api.obtenerCarrito();
      actualizarContador(cart.item_count);
    } catch {
      actualizarContador(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refrescarContador();
  }, [refrescarContador]);

  const value = useMemo(() => ({ itemCount, actualizarContador, refrescarContador }), [itemCount, refrescarContador]);
  return <ContextoCarrito.Provider value={value}>{children}</ContextoCarrito.Provider>;
}

export function useCarrito(): CartContextValue {
  const context = useContext(ContextoCarrito);
  if (!context) throw new Error("useCarrito debe usarse dentro de ProveedorCarrito");
  return context;
}
