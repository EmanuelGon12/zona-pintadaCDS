import { api } from "./api.js";
import { isAuthenticated } from "./session.js";

let itemCount = 0;
const listeners = new Set();

export const getCartItemCount = () => itemCount;

export function setCartItemCount(count) {
  itemCount = count;
  listeners.forEach((listener) => listener(itemCount));
}

export function subscribeToCart(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshCartItemCount() {
  if (!isAuthenticated()) {
    setCartItemCount(0);
    return;
  }
  try {
    const cart = await api.getCart();
    setCartItemCount(cart.item_count);
  } catch {
    setCartItemCount(0);
  }
}
