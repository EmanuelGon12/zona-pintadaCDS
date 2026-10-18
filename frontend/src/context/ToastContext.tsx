import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastTone = "default" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const VISIBLE_MILLISECONDS = 3800;

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = "default") => {
    const toast = { id: nextToastId++, message, tone };
    setToasts((current) => [...current, toast]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), VISIBLE_MILLISECONDS);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
