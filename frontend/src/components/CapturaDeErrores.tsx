import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  clave: string; // al cambiar de pagina se resetea, asi un error no queda pegado en toda la app
}

interface Estado {
  error: Error | null;
}

// los error boundaries de react todavia tienen que ser clases
export class CapturaDeErrores extends Component<Props, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidUpdate(anteriores: Props) {
    if (anteriores.clave !== this.props.clave && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("error al mostrar la pagina", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="wrapper page message-page" role="alert">
        <h1 className="display">Algo salió mal</h1>
        <p>No pudimos mostrar esta página. Prueba recargando.</p>
        <button className="button" type="button" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </section>
    );
  }
}
