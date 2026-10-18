import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MessagePage } from "./components/PageStates";
import { RequireAdministrator, RequireAuthentication } from "./components/RouteGuards";
import { AdminEditProductPage, AdminNewProductPage } from "./pages/admin/AdminProductFormPage";
import { AdminProductsPage } from "./pages/admin/AdminProductsPage";
import { LoginPage, RegistrationPage } from "./pages/AuthenticationPages";
import { CartPage } from "./pages/CartPage";
import { CatalogPage, NewArrivalsPage } from "./pages/CatalogPage";
import { HomePage, StyleFinderPage } from "./pages/HomePage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductPage } from "./pages/ProductPage";
import { SimulatedPaymentPage } from "./pages/SimulatedPaymentPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="modelos" element={<CatalogPage />} />
        <Route path="novedades" element={<NewArrivalsPage />} />
        <Route path="estilo-de-juego" element={<StyleFinderPage />} />
        <Route path="producto/:productId" element={<ProductPage />} />
        <Route path="ingresar" element={<LoginPage />} />
        <Route path="registro" element={<RegistrationPage />} />
        <Route path="carrito" element={<RequireAuthentication><CartPage /></RequireAuthentication>} />
        <Route path="pago-simulado/:orderId" element={<RequireAuthentication><SimulatedPaymentPage /></RequireAuthentication>} />
        <Route path="pedidos" element={<RequireAuthentication><OrdersPage /></RequireAuthentication>} />
        <Route path="pedidos/:orderId" element={<RequireAuthentication><OrderDetailPage /></RequireAuthentication>} />
        <Route path="admin" element={<RequireAdministrator><AdminProductsPage /></RequireAdministrator>} />
        <Route path="admin/productos/nuevo" element={<RequireAdministrator><AdminNewProductPage /></RequireAdministrator>} />
        <Route path="admin/productos/:productId" element={<RequireAdministrator><AdminEditProductPage /></RequireAdministrator>} />
        <Route path="*" element={<MessagePage title="No encontramos esa página" />} />
      </Route>
    </Routes>
  );
}
