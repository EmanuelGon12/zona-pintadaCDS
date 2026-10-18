import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ProveedorCarrito } from "./context/ContextoCarrito";
import { ProveedorSesion } from "./context/ContextoSesion";
import { ProveedorAvisos } from "./context/ContextoAvisos";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorAvisos>
        <ProveedorSesion>
          <ProveedorCarrito>
            <App />
          </ProveedorCarrito>
        </ProveedorSesion>
      </ProveedorAvisos>
    </BrowserRouter>
  </StrictMode>
);
