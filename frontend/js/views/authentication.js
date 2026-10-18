import { api } from "../api.js";
import { refreshCartItemCount } from "../cartStore.js";
import { showToast } from "../components/toast.js";
import { h } from "../dom.js";
import { navigate } from "../router.js";
import { saveSession } from "../session.js";

function textField({ id, label, type = "text", autocomplete, hint, minlength }) {
  return h(
    "div",
    { class: "field-group" },
    h("label", { class: "field-label", for: id }, label),
    h("input", { class: "input", id, name: id, type, autocomplete, required: true, minlength, maxlength: type === "password" ? "72" : "120" }),
    hint ? h("p", { class: "field-hint" }, hint) : null
  );
}

function authenticationPage({ title, intro, fields, submitLabel, alternative, onSubmit }) {
  const errorSlot = h("p", { class: "form-error", role: "alert", hidden: true });

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector("button[type=submit]");
    errorSlot.hidden = true;
    submitButton.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
    } catch (error) {
      errorSlot.textContent = error.message;
      errorSlot.hidden = false;
      submitButton.disabled = false;
    }
  }

  return h(
    "section",
    { class: "wrapper page auth" },
    h(
      "div",
      { class: "auth__panel" },
      h("h1", { class: "display" }, title),
      h("p", { class: "auth__intro" }, intro),
      h("form", { class: "form", onsubmit: handleSubmit }, fields, errorSlot, h("button", { class: "button button--wide", type: "submit" }, submitLabel)),
      h("p", { class: "auth__alternative" }, alternative)
    )
  );
}

async function completeAuthentication(sessionPayload, returnPath, welcomeMessage) {
  saveSession(sessionPayload);
  await refreshCartItemCount();
  showToast(welcomeMessage);
  navigate(returnPath && returnPath.startsWith("/") ? returnPath : "/");
}

export function loginView({ query }) {
  const returnPath = query.get("volver");
  const registrationLink = `#/registro${returnPath ? `?volver=${encodeURIComponent(returnPath)}` : ""}`;
  return authenticationPage({
    title: "Ingresar",
    intro: "Entra con tu cuenta para ver tu carrito y tus pedidos.",
    fields: [
      textField({ id: "email", label: "Email", type: "email", autocomplete: "email" }),
      textField({ id: "password", label: "Contraseña", type: "password", autocomplete: "current-password" }),
    ],
    submitLabel: "Ingresar",
    alternative: ["¿Todavía no tienes cuenta? ", h("a", { class: "text-link", href: registrationLink }, "Crear una")],
    onSubmit: async (values) => {
      const sessionPayload = await api.login({ email: values.email, password: values.password });
      await completeAuthentication(sessionPayload, returnPath, `Hola, ${sessionPayload.user.full_name.split(" ")[0]}.`);
    },
  });
}

export function registrationView({ query }) {
  const returnPath = query.get("volver");
  const loginLink = `#/ingresar${returnPath ? `?volver=${encodeURIComponent(returnPath)}` : ""}`;
  return authenticationPage({
    title: "Crear cuenta",
    intro: "Con tu cuenta puedes comprar y seguir el estado de tus pedidos.",
    fields: [
      textField({ id: "full_name", label: "Nombre y apellido", autocomplete: "name", minlength: 2 }),
      textField({ id: "email", label: "Email", type: "email", autocomplete: "email" }),
      textField({ id: "password", label: "Contraseña", type: "password", autocomplete: "new-password", minlength: 8, hint: "Mínimo 8 caracteres." }),
    ],
    submitLabel: "Crear cuenta",
    alternative: ["¿Ya tienes cuenta? ", h("a", { class: "text-link", href: loginLink }, "Ingresar")],
    onSubmit: async (values) => {
      const sessionPayload = await api.register({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
      });
      await completeAuthentication(sessionPayload, returnPath, "Tu cuenta está lista.");
    },
  });
}
