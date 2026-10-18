import { useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useCarrito } from "../context/ContextoCarrito";
import { useSesion } from "../context/ContextoSesion";
import { useCerrarSesion } from "../hooks/useCerrarSesion";
import { IconoBolsa, IconoLupa, IconoUsuario } from "./Iconos";

const PRIMARY_LINKS = [
  { label: "Novedades", to: "/novedades" },
  { label: "Modelos", to: "/modelos" },
  { label: "Encuentra tu zapatilla", to: "/estilo-de-juego" },
];

function Buscador() {
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const { pathname } = useLocation();
  const currentTerm = pathname === "/modelos" ? searchParameters.get("q") ?? "" : "";
  const [term, setTerm] = useState(currentTerm);
  const [lastSyncedTerm, setLastSyncedTerm] = useState(currentTerm);

  // si la busqueda cambia desde afuera (ej. "quitar busqueda") actualizo el input
  if (currentTerm !== lastSyncedTerm) {
    setLastSyncedTerm(currentTerm);
    setTerm(currentTerm);
  }

  function buscar(event: FormEvent) {
    event.preventDefault();
    const trimmed = term.trim();
    navigate(trimmed ? `/modelos?q=${encodeURIComponent(trimmed)}` : "/modelos");
  }

  return (
    <form className="search" role="search" onSubmit={buscar}>
      <label className="visually-hidden" htmlFor="search-input">
        Buscar modelos
      </label>
      <span className="search__icon">
        <IconoLupa />
      </span>
      <input
        id="search-input"
        className="search__input"
        type="search"
        placeholder="Buscar"
        autoComplete="off"
        maxLength={80}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
    </form>
  );
}

function ZonaCuenta() {
  const { user, isAdministrator } = useSesion();
  const logOut = useCerrarSesion();

  if (!user) {
    return (
      <Link className="account-link" to="/ingresar">
        <IconoUsuario />
        <span>Ingresar</span>
      </Link>
    );
  }

  return (
    <div className="account">
      <NavLink className="account-link" to="/pedidos">
        <IconoUsuario />
        <span>{user.full_name.split(" ")[0]}</span>
      </NavLink>
      {isAdministrator && (
        <Link className="account__extra" to="/admin">
          Administración
        </Link>
      )}
      <button className="account__extra" type="button" onClick={logOut}>
        Salir
      </button>
    </div>
  );
}

export function Encabezado() {
  const { itemCount } = useCarrito();

  return (
    <>
      <div className="announcement">Envío gratis desde $ 6.000 · Cambios dentro de 30 días</div>
      <header className="site-header">
        <div className="wrapper site-header__inner">
          <Link className="brand" to="/" aria-label="Zona Pintada, inicio">
            Zona<span>Pintada</span>
          </Link>
          <nav className="primary-nav" aria-label="Principal">
            {PRIMARY_LINKS.map((link) => (
              <NavLink key={link.to} className="primary-nav__link" to={link.to}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="site-header__actions">
            <Buscador />
            <ZonaCuenta />
            <Link className="cart-link" to="/carrito" aria-label={`Carrito, ${itemCount} productos`}>
              <IconoBolsa />
              {itemCount > 0 && <span className="cart-link__count">{itemCount}</span>}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
