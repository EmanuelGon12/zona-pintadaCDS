const STORAGE_KEY = "zona-pintada.session";
const listeners = new Set();

function readStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

let currentSession = readStoredSession();

function notify() {
  listeners.forEach((listener) => listener(currentSession));
}

export const getToken = () => currentSession?.access_token ?? null;
export const getUser = () => currentSession?.user ?? null;
export const isAuthenticated = () => currentSession !== null;
export const isAdministrator = () => currentSession?.user?.role === "ADMIN";

export function saveSession(sessionPayload) {
  currentSession = sessionPayload;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionPayload));
  notify();
}

export function clearSession() {
  currentSession = null;
  localStorage.removeItem(STORAGE_KEY);
  notify();
}

export function subscribeToSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
