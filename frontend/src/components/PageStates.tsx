import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function LoadingState() {
  return (
    <div className="wrapper page loading" role="status">
      Cargando…
    </div>
  );
}

export function MessagePage({ title, children }: { title: string; children?: ReactNode }) {
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

export function ErrorState({ error }: { error: Error }) {
  return (
    <MessagePage title="Algo salió mal">
      <p>{error.message || "No pudimos cargar esta página."}</p>
    </MessagePage>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {action}
    </div>
  );
}
