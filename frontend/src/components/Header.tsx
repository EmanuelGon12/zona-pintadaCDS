import { useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useSession } from "../context/SessionContext";
import { useLogOut } from "../hooks/useLogOut";
import { BagIcon, SearchIcon, UserIcon } from "./Icons";

const PRIMARY_LINKS = [
  { label: "Novedades", to: "/novedades" },
  { label: "Modelos", to: "/modelos" },
  { label: "Encuentra tu zapatilla", to: "/estilo-de-juego" },
];

function SearchForm() {
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const { pathname } = useLocation();
  const currentTerm = pathname === "/modelos" ? searchParameters.get("q") ?? "" : "";
  const [term, setTerm] = useState(currentTerm);
  const [lastSyncedTerm, setLastSyncedTerm] = useState(currentTerm);

  if (currentTerm !== lastSyncedTerm) {
    setLastSyncedTerm(currentTerm);
    setTerm(currentTerm);
  }

  function search(event: FormEvent) {
    event.preventDefault();
    const trimmed = term.trim();
    navigate(trimmed ? `/modelos?q=${encodeURIComponent(trimmed)}` : "/modelos");
  }

  return (
    <form className="search" role="search" onSubmit={search}>
      <label className="visually-hidden" htmlFor="search-input">
        Buscar modelos
      </label>
      <span className="search__icon">
        <SearchIcon />
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

function AccountArea() {
  const { user, isAdministrator } = useSession();
  const logOut = useLogOut();

  if (!user) {
    return (
      <Link className="account-link" to="/ingresar">
        <UserIcon />
        <span>Ingresar</span>
      </Link>
    );
  }

  return (
    <div className="account">
      <NavLink className="account-link" to="/pedidos">
        <UserIcon />
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

export function Header() {
  const { itemCount } = useCart();

  return (
    <>
      <div className="announcement">Envío gratis desde USD 150 · Cambios dentro de 30 días</div>
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
            <SearchForm />
            <AccountArea />
            <Link className="cart-link" to="/carrito" aria-label={`Carrito, ${itemCount} productos`}>
              <BagIcon />
              {itemCount > 0 && <span className="cart-link__count">{itemCount}</span>}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
