import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
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
  return (
    <>
      <VolverArribaAlNavegar />
      <Encabezado />
      <main>
        <Outlet />
      </main>
      <PieDePagina />
    </>
  );
}
