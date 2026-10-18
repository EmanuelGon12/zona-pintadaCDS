import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export const Cargando = () => <div className="wrapper page loading" role="status">Cargando…</div>;

export function PaginaMensaje({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="wrapper page message-page">
      <h1 className="display">{title}</h1>
      {children}
      <Link className="button" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}

export function EstadoError({ error }: { error: Error }) {
  return (
    <PaginaMensaje title="Algo salió mal">
      <p>{error.message || "No pudimos cargar esta página."}</p>
    </PaginaMensaje>
  );
}

export function EstadoVacio({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {action}
    </div>
  );
}
