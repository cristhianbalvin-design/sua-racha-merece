import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import mascote from "../assets/buky-mascote.webp";
import "../theme.css";
import { pt } from "../i18n";

/** Entrar (mockup 0): "Pegue bukys. Ganhe correndo." */
export default function Entrar() {
  const { login, loginWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo ?? "/app";

  if (!loading && user) return <Navigate to={redirectTo.startsWith("/app") ? redirectTo : "/app"} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(pt.entrar.erro);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(redirectTo.startsWith("/app") ? redirectTo : "/app", { replace: true });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      setError(msg.includes("desabilitada") ? msg : pt.entrar.erro);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="buky">
      <main className="relative mx-auto flex min-h-svh w-full max-w-[480px] flex-col overflow-hidden px-7 pb-8 pt-[calc(env(safe-area-inset-top,0px)+28px)]">
        <p className="font-buky text-center text-[26px]">
          <span className="text-[var(--buky-neon)]">3</span>buk
        </p>

        {/* "CORRE" en contorno detrás de la mascota */}
        <div className="relative mt-4 h-[290px]" aria-hidden>
          <span
            className="font-buky absolute left-1/2 top-[40px] -translate-x-1/2 whitespace-nowrap text-[190px] text-transparent"
            style={{ WebkitTextStroke: "1.5px #39ff14", opacity: 0.85 }}
          >
            CORRE
          </span>
          <img src={mascote} alt="" className="absolute left-1/2 top-0 h-[290px] w-auto -translate-x-[60%]" />
        </div>

        <h1 className="font-buky mt-auto text-[42px]">
          {pt.entrar.title1}
          <br />
          <span className="text-[var(--buky-neon)]">{pt.entrar.title2}</span>
        </h1>

        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <label className="buky-field">
            <span>{pt.entrar.email}</span>
            <input type="email" autoComplete="email" inputMode="email" placeholder={pt.entrar.emailPh} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="buky-field">
            <span>{pt.entrar.senha}</span>
            <div className="flex items-center gap-2">
              <input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="text-[var(--buky-muted)]">
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          {error && (
            <p className="text-sm text-[var(--buky-danger)]" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="buky-btn" disabled={busy}>
            {busy ? pt.comum.carregando : pt.entrar.entrar}
          </button>
        </form>

        <button type="button" onClick={() => void loginWithGoogle("/app")} className="buky-btn buky-btn-ghost mt-3 h-12 text-[15px]">
          {pt.entrar.google}
        </button>

        <Link to="/forgot-password" className="mt-4 text-center text-sm text-[var(--buky-muted)]">
          {pt.entrar.esqueceu}
        </Link>
        <p className="mt-6 text-center text-[15px] text-[var(--buky-muted)]">
          {pt.entrar.primeiraVez}{" "}
          <Link to="/cadastro" className="font-semibold text-[var(--buky-neon)]">
            {pt.entrar.criarConta}
          </Link>
        </p>
      </main>
    </div>
  );
}
