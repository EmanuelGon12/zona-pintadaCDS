import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastTone = "default" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const VISIBLE_MILLISECONDS = 3800;

const ContextoAvisos = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

let nextToastId = 1;

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrarAviso = useCallback((message: string, tone: ToastTone = "default") => {
    const toast = { id: nextToastId++, message, tone };
    setToasts((current) => [...current, toast]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), VISIBLE_MILLISECONDS);
  }, []);

  return (
    <ContextoAvisos.Provider value={mostrarAviso}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

export const useAvisos = () => useContext(ContextoAvisos);
