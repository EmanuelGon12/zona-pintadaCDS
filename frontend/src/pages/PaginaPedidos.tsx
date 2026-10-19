import { api } from '../api/cliente'
import { Link } from 'react-router-dom'
import { EstadoPedido } from '../components/EstadoPedido'
import { EstadoVacio, EstadoError, Cargando } from '../components/EstadosDePagina'
import { useSesion } from '../context/ContextoSesion'
import { useCargarDatos } from '../hooks/useCargarDatos'
import { useCerrarSesion } from '../hooks/useCerrarSesion'
import { formatearFecha, numeroDePedido, formatearPrecio } from '../lib/formato'

function PanelCuenta() {
  const { user, isAdministrator } = useSesion();
  const logOut = useCerrarSesion();
  if (!user) return null;

  return (
    <div className="account-panel">
      <div>
        <p className="account-panel__name">{user.full_name}</p>
        <p className="muted">{user.email}</p>
      </div>
      <div className="account-panel__actions">
        {isAdministrator && (
          <Link className="text-link" to="/admin">
            Administración
          </Link>
        )}
        <button className="text-button" type="button" onClick={logOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function PaginaPedidos() {
  const { data: orders, error, isLoading } = useCargarDatos(() => api.listarPedidos(), "pedidos");

  if (isLoading) return <Cargando />;
  if (error || !orders) return <EstadoError error={error ?? new Error("No pudimos cargar tus pedidos.")} />;

  return (
    <section className="wrapper page">
      <PanelCuenta />
      <h1 className="display">Mis pedidos</h1>
      {orders.length === 0 ? (
        <EstadoVacio
          message="Todavía no hiciste ningún pedido."
          action={
            <Link className="button" to="/modelos">
              Ver los modelos
            </Link>
          }
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Fecha</th>
              <th>Pares</th>
              <th>Estado</th>
              <th className="numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td data-label="Pedido">
                  <Link className="text-link" to={`/pedidos/${order.id}`}>
                    {numeroDePedido(order.id)}
                  </Link>
                </td>
                <td data-label="Fecha">{formatearFecha(order.created_at)}</td>
                <td data-label="Pares">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td data-label="Estado">
                  <EstadoPedido status={order.status} />
                </td>
                <td className="numeric" data-label="Total">
                  {formatearPrecio(order.total_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
