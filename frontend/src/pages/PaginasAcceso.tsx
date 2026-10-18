import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/cliente";
import type { Session } from "../api/tipos";
import { useSesion } from "../context/ContextoSesion";
import { useAvisos } from "../context/ContextoAvisos";
import { rutaDeVueltaSegura } from "../lib/rutaCatalogo";

interface TextFieldProps {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}

function CampoTexto({ id, label, type = "text", autoComplete, minLength, hint }: TextFieldProps) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="input"
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        maxLength={type === "password" ? 72 : 120}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

interface AuthenticationFormProps {
  title: string;
  intro: string;
  submitLabel: string;
  alternative: ReactNode;
  children: ReactNode;
  autenticar: (values: Record<string, string>) => Promise<Session>;
  mensajeBienvenida: (session: Session) => string;
}

function FormularioAcceso({ title, intro, submitLabel, alternative, children, autenticar, mensajeBienvenida }: AuthenticationFormProps) {
  const { guardarSesion } = useSesion();
  const mostrarAviso = useAvisos();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const session = await autenticar(values);
      guardarSesion(session);
      mostrarAviso(mensajeBienvenida(session));
      navigate(rutaDeVueltaSegura(searchParameters.get("volver")), { replace: true });
    } catch (error) {
      setErrorMessage((error as Error).message);
      setIsSubmitting(false);
    }
  }

  return (
    <section className="wrapper page auth">
      <div className="auth__panel">
        <h1 className="display">{title}</h1>
        <p className="auth__intro">{intro}</p>
        <form className="form" onSubmit={enviar}>
          {children}
          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button className="button button--wide" type="submit" disabled={isSubmitting}>
            {submitLabel}
          </button>
        </form>
        <p className="auth__alternative">{alternative}</p>
      </div>
    </section>
  );
}

function useLinkConVuelta(path: string): string {
  const [searchParameters] = useSearchParams();
  const returnPath = searchParameters.get("volver");
  return returnPath ? `${path}?volver=${encodeURIComponent(returnPath)}` : path;
}

export function PaginaIngreso() {
  const registrationLink = useLinkConVuelta("/registro");
  return (
    <FormularioAcceso
      title="Ingresar"
      intro="Entra con tu cuenta para ver tu carrito y tus pedidos."
      submitLabel="Ingresar"
      alternative={
        <>
          ¿Todavía no tienes cuenta?{" "}
          <Link className="text-link" to={registrationLink}>
            Crear una
          </Link>
        </>
      }
      autenticar={(values) => api.ingresar({ email: values.email, password: values.password })}
      mensajeBienvenida={(session) => `Hola, ${session.user.full_name.split(" ")[0]}.`}
    >
      <CampoTexto id="email" label="Email" type="email" autoComplete="email" />
      <CampoTexto id="password" label="Contraseña" type="password" autoComplete="current-password" />
    </FormularioAcceso>
  );
}

export function PaginaRegistro() {
  const loginLink = useLinkConVuelta("/ingresar");
  return (
    <FormularioAcceso
      title="Crear cuenta"
      intro="Con tu cuenta puedes comprar y seguir el estado de tus pedidos."
      submitLabel="Crear cuenta"
      alternative={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link className="text-link" to={loginLink}>
            Ingresar
          </Link>
        </>
      }
      autenticar={(values) => api.registrarse({ full_name: values.full_name, email: values.email, password: values.password })}
      mensajeBienvenida={() => "Tu cuenta está lista."}
    >
      <CampoTexto id="full_name" label="Nombre y apellido" autoComplete="name" minLength={2} />
      <CampoTexto id="email" label="Email" type="email" autoComplete="email" />
      <CampoTexto id="password" label="Contraseña" type="password" autoComplete="new-password" minLength={8} hint="Mínimo 8 caracteres." />
    </FormularioAcceso>
  );
}
