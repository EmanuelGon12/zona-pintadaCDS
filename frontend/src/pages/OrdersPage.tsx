import { Link } from "react-router-dom";
import { api } from "../api/client";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/PageStates";
import { useSession } from "../context/SessionContext";
import { useAsync } from "../hooks/useAsync";
import { useLogOut } from "../hooks/useLogOut";
import { formatDate, formatOrderNumber, formatPrice } from "../lib/format";

function AccountPanel() {
  const { user, isAdministrator } = useSession();
  const logOut = useLogOut();
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

export function OrdersPage() {
  const { data: orders, error, isLoading } = useAsync(() => api.listOrders(), []);

  if (isLoading) return <LoadingState />;
  if (error || !orders) return <ErrorState error={error ?? new Error("No pudimos cargar tus pedidos.")} />;

  return (
    <section className="wrapper page">
      <AccountPanel />
      <h1 className="display">Mis pedidos</h1>
      {orders.length === 0 ? (
        <EmptyState
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
                    {formatOrderNumber(order.id)}
                  </Link>
                </td>
                <td data-label="Fecha">{formatDate(order.created_at)}</td>
                <td data-label="Pares">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td data-label="Estado">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="numeric" data-label="Total">
                  {formatPrice(order.total_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
