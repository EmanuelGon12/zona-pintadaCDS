import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { Header } from "./Header";

function ScrollToTopOnNavigation() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <>
      <ScrollToTopOnNavigation />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
