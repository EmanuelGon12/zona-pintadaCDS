import { Route, Routes } from "react-router-dom";
import { Plantilla } from "./components/Plantilla";
import { PaginaMensaje } from "./components/EstadosDePagina";
import { SoloAdmin, SoloLogueados } from "./components/ProteccionRutas";
import { PaginaEditarProducto, PaginaNuevoProducto } from "./pages/admin/PaginasFormularioProducto";
import { PaginaAdminProductos } from "./pages/admin/PaginaAdminProductos";
import { PaginaIngreso, PaginaRegistro } from "./pages/PaginasAcceso";
import { PaginaCarrito } from "./pages/PaginaCarrito";
import { PaginaCatalogo, PaginaNovedades } from "./pages/PaginaCatalogo";
import { PaginaInicio, PaginaSelectorEstilo } from "./pages/PaginaInicio";
import { PaginaDetallePedido } from "./pages/PaginaDetallePedido";
import { PaginaPedidos } from "./pages/PaginaPedidos";
import { PaginaProducto } from "./pages/PaginaProducto";
import { PaginaPagoSimulado } from "./pages/PaginaPagoSimulado";

export function App() {
  return (
    <Routes>
      <Route element={<Plantilla />}>
        <Route index element={<PaginaInicio />} />
        <Route path="modelos" element={<PaginaCatalogo />} />
        <Route path="novedades" element={<PaginaNovedades />} />
        <Route path="estilo-de-juego" element={<PaginaSelectorEstilo />} />
        <Route path="producto/:productId" element={<PaginaProducto />} />
        <Route path="ingresar" element={<PaginaIngreso />} />
        <Route path="registro" element={<PaginaRegistro />} />
        <Route path="carrito" element={<SoloLogueados><PaginaCarrito /></SoloLogueados>} />
        <Route path="pago-simulado/:orderId" element={<SoloLogueados><PaginaPagoSimulado /></SoloLogueados>} />
        <Route path="pedidos" element={<SoloLogueados><PaginaPedidos /></SoloLogueados>} />
        <Route path="pedidos/:orderId" element={<SoloLogueados><PaginaDetallePedido /></SoloLogueados>} />
        <Route path="admin" element={<SoloAdmin><PaginaAdminProductos /></SoloAdmin>} />
        <Route path="admin/productos/nuevo" element={<SoloAdmin><PaginaNuevoProducto /></SoloAdmin>} />
        <Route path="admin/productos/:productId" element={<SoloAdmin><PaginaEditarProducto /></SoloAdmin>} />
        <Route path="*" element={<PaginaMensaje title="No encontramos esa página" />} />
      </Route>
    </Routes>
  );
}
