import type { User } from "./tipos";

// solo guardo los datos del usuario para mostrar el nombre al recargar.
// La sesion de verdad es la cookie HttpOnly, que javascript no puede leer
const STORAGE_KEY = "zona-pintada.usuario";

export function leerUsuarioGuardado(): User | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
}

export function guardarUsuarioLocal(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    return;
  }
}
