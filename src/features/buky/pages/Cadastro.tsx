import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TermsModal } from "@/components/TermsModal";
import "../theme.css";
import { pt } from "../i18n";
import CityPicker from "../components/CityPicker";
import { updateProfile, type City } from "../lib/api";
import { cleanInstagram, isValidEmail, isValidInstagram, isValidName, isValidNeighborhood, isValidPassword } from "../lib/validation";
import { savePendingProfile } from "../lib/pendingProfile";

type Errors = Partial<Record<"nome" | "email" | "instagram" | "bairro" | "cidade" | "senha" | "confirmar" | "termos", string>>;

/** Cadastro (mockup 0 · Registro) con los campos obligatorios de los requerimientos. */
export default function Cadastro() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ nome: "", email: "", instagram: "", bairro: "", senha: "", confirmar: "" });
  const [city, setCity] = useState<City | null>(null);
  const [terms, setTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  if (!loading && user && !busy) return <Navigate to="/app" replace />;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const validate = (): Errors => {
    const e: Errors = {};
    const E = pt.cadastro.erros;
    if (!isValidName(f.nome)) e.nome = E.nome;
    if (!isValidEmail(f.email)) e.email = E.email;
    if (!isValidInstagram(f.instagram)) e.instagram = E.instagram;
    if (!isValidNeighborhood(f.bairro)) e.bairro = E.bairro;
    if (!city) e.cidade = E.cidade;
    if (!isValidPassword(f.senha)) e.senha = E.senha;
    if (f.confirmar !== f.senha || !f.confirmar) e.confirmar = E.confirmar;
    if (!terms) e.termos = E.termos;
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error(Object.values(e)[0]);
      return;
    }
    setBusy(true);
    const profile = { instagram: cleanInstagram(f.instagram), neighborhood: f.bairro.trim(), city_code: city!.code, name: f.nome.trim() };
    // Si el proyecto pide confirmar el e-mail no hay sesión todavía: se completa al primer ingreso.
    savePendingProfile(f.email.trim(), profile);
    try {
      await register(f.email.trim(), f.senha, profile.name, true);
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await updateProfile(data.session.user.id, profile);
        navigate("/app", { replace: true });
      } else {
        toast.success("Conta criada! Confirme seu e-mail e depois entre.");
        navigate("/entrar", { replace: true });
      }
    } catch (err) {
      toast.error(`Erro ao criar conta: ${(err as Error).message ?? pt.comum.erro}`);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof Errors) => (errors[k] ? "true" : undefined);

  return (
    <div className="buky">
      <main className="mx-auto w-full max-w-[480px] px-7 pb-10 pt-[calc(env(safe-area-inset-top,0px)+24px)]">
        <div className="flex items-center justify-between">
          <Link to="/entrar" aria-label={pt.comum.voltar} className="-ml-1 p-1">
            <ChevronLeft size={26} />
          </Link>
          <span className="text-sm font-semibold text-[var(--buky-muted)]">{pt.cadastro.passo}</span>
        </div>
        <h1 className="font-buky mt-4 text-[48px]">
          {pt.cadastro.title1}
          <br />
          <span className="text-[var(--buky-neon)]">{pt.cadastro.title2}</span>
        </h1>

        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          <label className="buky-field" data-invalid={field("nome")}>
            <span>{pt.cadastro.nome}</span>
            <input autoComplete="name" value={f.nome} onChange={set("nome")} />
          </label>
          <label className="buky-field" data-invalid={field("email")}>
            <span>{pt.cadastro.email}</span>
            <input type="email" inputMode="email" autoComplete="email" placeholder={pt.entrar.emailPh} value={f.email} onChange={set("email")} />
          </label>
          <label className="buky-field" data-invalid={field("instagram")}>
            <span>{pt.cadastro.instagram}</span>
            <div className="flex items-center gap-1">
              <span className="text-[17px] text-[var(--buky-faint)]">@</span>
              <input autoCapitalize="none" autoCorrect="off" placeholder={pt.cadastro.instagramPh} value={f.instagram} onChange={set("instagram")} />
            </div>
          </label>
          <label className="buky-field" data-invalid={field("bairro")}>
            <span>{pt.cadastro.bairro}</span>
            <input value={f.bairro} onChange={set("bairro")} maxLength={80} />
          </label>
          <CityPicker value={city} onChange={setCity} invalid={Boolean(errors.cidade)} />
          <label className="buky-field" data-invalid={field("senha")}>
            <span>{pt.cadastro.senha}</span>
            <div className="flex items-center gap-2">
              <input type={show ? "text" : "password"} autoComplete="new-password" value={f.senha} onChange={set("senha")} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="text-[var(--buky-muted)]">
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          <label className="buky-field" data-invalid={field("confirmar")}>
            <span>{pt.cadastro.confirmar}</span>
            <div className="flex items-center gap-2">
              <input type={show ? "text" : "password"} autoComplete="new-password" value={f.confirmar} onChange={set("confirmar")} />
              {f.confirmar && f.confirmar === f.senha && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--buky-neon)] text-[#050505]" aria-label="Senhas coincidem">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </div>
          </label>

          <label className="flex items-center gap-3 text-[14px] text-[var(--buky-muted)]">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#39ff14]"
              aria-invalid={Boolean(errors.termos)}
            />
            <span>
              {pt.cadastro.aceito}{" "}
              <button type="button" onClick={() => setShowTerms(true)} className="text-[var(--buky-neon)]">
                {pt.cadastro.termos}
              </button>{" "}
              {pt.cadastro.e}{" "}
              <button type="button" onClick={() => setShowTerms(true)} className="text-[var(--buky-neon)]">
                {pt.cadastro.privacidade}
              </button>
              .
            </span>
          </label>

          <button type="submit" className="buky-btn" disabled={busy}>
            {busy ? pt.comum.carregando : pt.cadastro.criar}
          </button>
        </form>

        <p className="mt-8 text-center text-[15px] text-[var(--buky-muted)]">
          {pt.cadastro.jaTem}{" "}
          <Link to="/entrar" className="font-semibold text-[var(--buky-neon)]">
            {pt.cadastro.entrar}
          </Link>
        </p>
      </main>
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} onAccept={() => setTerms(true)} />
    </div>
  );
}
