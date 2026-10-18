import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useSession } from "./SessionContext";

interface CartContextValue {
  itemCount: number;
  setItemCount: (count: number) => void;
  refreshItemCount: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession();
  const [itemCount, setItemCount] = useState(0);

  const refreshItemCount = useCallback(async () => {
    if (!isAuthenticated) {
      setItemCount(0);
      return;
    }
    try {
      const cart = await api.getCart();
      setItemCount(cart.item_count);
    } catch {
      setItemCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshItemCount();
  }, [refreshItemCount]);

  const value = useMemo(() => ({ itemCount, setItemCount, refreshItemCount }), [itemCount, refreshItemCount]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
