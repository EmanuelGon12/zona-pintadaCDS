import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrapper site-footer__columns">
        <div className="site-footer__brand">
          <p className="brand">
            Zona<span>Pintada</span>
          </p>
          <p>Calzado de básquetbol para cancha cubierta y exterior.</p>
        </div>
        <div>
          <h2>Tienda</h2>
          <ul>
            <li><Link to="/novedades">Novedades</Link></li>
            <li><Link to="/modelos">Todos los modelos</Link></li>
            <li><Link to="/estilo-de-juego">Encuentra tu zapatilla</Link></li>
          </ul>
        </div>
        <div>
          <h2>Tu compra</h2>
          <ul>
            <li><Link to="/pedidos">Mis pedidos</Link></li>
            <li><Link to="/carrito">Carrito</Link></li>
          </ul>
        </div>
        <div>
          <h2>Ayuda</h2>
          <ul>
            <li>Envíos en 24 a 72 h hábiles</li>
            <li>Cambios dentro de 30 días</li>
            <li>Atención de lunes a viernes, 9 a 18 h</li>
          </ul>
        </div>
      </div>
      <div className="wrapper site-footer__legal">
        <span>© 2026 Zona Pintada</span>
        <span>Tienda de demostración: los pagos se procesan en modo de prueba y no se cobra nada.</span>
      </div>
    </footer>
  );
}
