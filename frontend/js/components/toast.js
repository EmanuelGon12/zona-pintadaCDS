import { h } from "../dom.js";

const VISIBLE_MILLISECONDS = 3800;

export function showToast(message, tone = "default") {
  const stack = document.getElementById("toast-slot");
  const toast = h("div", { class: `toast toast--${tone}` }, message);
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), VISIBLE_MILLISECONDS);
}
