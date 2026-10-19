import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<Data> {
  data: Data | null;
  error: Error | null;
  isLoading: boolean;
}

// "clave" identifica que se esta pidiendo (ej. "producto-3"). Cuando cambia, se vuelve a cargar.
// La funcion de carga la guardo en un ref para no tener que listarla como dependencia del efecto
export function useCargarDatos<Data>(loader: () => Promise<Data>, clave: string) {
  const [state, setState] = useState<AsyncState<Data>>({ data: null, error: null, isLoading: true });
  const [reloadCount, setReloadCount] = useState(0);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    // si el usuario cambia de pagina antes de que llegue la respuesta, la ignoramos
    let isCurrent = true;
    setState((previous) => ({ ...previous, isLoading: true, error: null }));
    loaderRef.current().then(
      (data) => isCurrent && setState({ data, error: null, isLoading: false }),
      (error: Error) => isCurrent && setState({ data: null, error, isLoading: false })
    );
    return () => {
      isCurrent = false;
    };
  }, [clave, reloadCount]);

  const cambiarDatos = useCallback((data: Data) => setState({ data, error: null, isLoading: false }), []);
  const recargar = useCallback(() => setReloadCount((count) => count + 1), []);

  return { ...state, cambiarDatos, recargar };
}
