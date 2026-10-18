import { useCallback, useEffect, useState } from "react";

interface AsyncState<Data> {
  data: Data | null;
  error: Error | null;
  isLoading: boolean;
}

export function useCargarDatos<Data>(loader: () => Promise<Data>, dependencies: unknown[]) {
  const [state, setState] = useState<AsyncState<Data>>({ data: null, error: null, isLoading: true });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // si el usuario cambia de pagina antes de que llegue la respuesta, la ignoramos
    let isCurrent = true;
    setState((previous) => ({ ...previous, isLoading: true, error: null }));
    loader().then(
      (data) => isCurrent && setState({ data, error: null, isLoading: false }),
      (error: Error) => isCurrent && setState({ data: null, error, isLoading: false })
    );
    return () => {
      isCurrent = false;
    };
  }, [...dependencies, reloadCount]);

  const cambiarDatos = useCallback((data: Data) => setState({ data, error: null, isLoading: false }), []);
  const recargar = useCallback(() => setReloadCount((count) => count + 1), []);

  return { ...state, cambiarDatos, recargar };
}
