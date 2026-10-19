import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CapturaDeErrores } from "./CapturaDeErrores";
import { PieDePagina } from "./PieDePagina";
import { Encabezado } from "./Encabezado";

function VolverArribaAlNavegar() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Plantilla() {
  const { pathname } = useLocation();
  return (
    <>
      <VolverArribaAlNavegar />
      <Encabezado />
      <main>
        <CapturaDeErrores clave={pathname}>
          <Outlet />
        </CapturaDeErrores>
      </main>
      <PieDePagina />
    </>
  );
}
