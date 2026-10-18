import { Fragment } from "react";
import { Link } from "react-router-dom";

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Ruta">
      {trail.map((crumb, index) => (
        <Fragment key={crumb.label}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
