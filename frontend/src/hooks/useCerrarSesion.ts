import { useCarrito } from '../context/ContextoCarrito'
import { useSesion } from '../context/ContextoSesion'
import { useAvisos } from '../context/ContextoAvisos'

export function useCerrarSesion() {
  const { cerrarSesion } = useSesion();
  const { actualizarContador } = useCarrito();
  const mostrarAviso = useAvisos();

  return () => {
    cerrarSesion();
    actualizarContador(0);
    mostrarAviso("Cerraste sesión.");
  };
}
