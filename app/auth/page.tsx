"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";

function traducirError(mensaje: string) {
  if (mensaje.includes("Invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (mensaje.includes("Email not confirmed")) {
    return "Confirma tu correo antes de entrar.";
  }
  if (mensaje.includes("User already registered")) {
    return "Ese correo ya tiene una cuenta.";
  }
  if (mensaje.includes("Password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (mensaje.includes("Unable to validate email address")) {
    return "El correo no tiene un formato válido.";
  }
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

/** Mismo formato que guarda el trigger: mayúsculas y 10 caracteres. */
function normalizarUsuario(valor: string) {
  return valor.trim().toUpperCase().slice(0, 10);
}

function AuthCard() {
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const searchParams = useSearchParams();
  const [error, setError] = useState(
    searchParams.get("error") === "callback"
      ? "El enlace de confirmación no es válido o ya caducó."
      : ""
  );
  const { playAsGuest } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const cambiarTab = (siguiente: "in" | "up") => {
    setTab(siguiente);
    setError("");
    setRegistrado(false);
  };

  const iniciarSesion = async () => {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });

    if (signInError) {
      setError(traducirError(signInError.message));
      setSending(false);
      return;
    }

    router.push("/games");
    router.refresh();
  };

  const crearCuenta = async () => {
    const username = normalizarUsuario(user);

    if (!username) {
      setError("Elige un nombre de usuario.");
      setSending(false);
      return;
    }

    // Comprobación de UX; la autoridad real es el índice unique de profiles.
    const { data: existente } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existente) {
      setError(`El usuario ${username} no está disponible.`);
      setSending(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(traducirError(signUpError.message));
      setSending(false);
      return;
    }

    setRegistrado(true);
    setSending(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setSending(true);

    if (tab === "in") {
      await iniciarSesion();
    } else {
      await crearCuenta();
    }
  };

  const enterAsGuest = () => {
    playAsGuest();
    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => cambiarTab("in")}>
            INICIAR SESIÓN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => cambiarTab("up")}>
            CREAR CUENTA
          </button>
        </div>

        {registrado ? (
          <div className="mono" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7 }}>
            <div className="neon-cyan" style={{ letterSpacing: "0.12em" }}>
              ▸ REVISA TU CORREO
            </div>
            <div style={{ color: "var(--ink-faint)", marginTop: 8 }}>
              Enviamos un enlace de confirmación a <strong>{email.trim()}</strong>. Ábrelo para
              activar la cuenta y entrar al vault.
            </div>
            <button
              className="btn ghost"
              type="button"
              style={{ width: "100%", marginTop: 14 }}
              onClick={() => cambiarTab("in")}
            >
              VOLVER A INICIAR SESIÓN
            </button>
          </div>
        ) : (
        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="mono"
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "var(--magenta)",
                letterSpacing: "0.08em",
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={sending}
            style={{ width: "100%", marginTop: 8 }}
          >
            {sending
              ? tab === "in"
                ? "ENTRANDO…"
                : "CREANDO…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={enterAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthCard />
    </Suspense>
  );
}
