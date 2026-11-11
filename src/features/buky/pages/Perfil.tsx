import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Footprints, LogOut, Pencil, Route, SlidersHorizontal, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGetMyWallet, brl } from "@/lib/walletApi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useSponsors } from "@/lib/sponsorApi";
import { avisos, pt } from "../i18n";
import { fmtDate, fmtDuration, isToday, ProfileAvatar, Sheet, Spinner } from "../components/ui";
import RouteSketch from "../components/RouteSketch";
import ShareButton from "../share/ShareButton";
import type { SessionHistoryItem } from "../lib/api";
import { useBukyProfile, useCity, useMySessions, useSummary } from "../lib/hooks";

/** Perfil (mockup 5): datos, 4 indicadores e historial de entrenamientos. */
export default function Perfil() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const sponsors = useSponsors();
  const emailPref = useQuery({
    queryKey: ["email-pref", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("email_notifications")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return (data as { email_notifications?: boolean } | null)?.email_notifications ?? true;
    },
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const setEmail = async (enabled: boolean) => {
    if (!user) return;
    setSavingEmail(true);
    const { error } = await supabase
      .from("users")
      .update({ email_notifications: enabled })
      .eq("id", user.id);
    if (error) toast.error("Não foi possível salvar a preferência.");
    else await emailPref.refetch();
    setSavingEmail(false);
  };
  const { data: p } = useBukyProfile();
  const { data: city } = useCity(p?.city_code);
  const { data: s } = useSummary();
  const { data: counters } = useQuery({
    queryKey: ["buky", "counters", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("buky_my_counters");
      if (error) throw error;
      return data as { sorteios: number };
    },
  });
  const { data: sessions = [], isLoading } = useMySessions();
  const [menu, setMenu] = useState(false);
  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: apiGetMyWallet,
    staleTime: 30_000,
  });

  const nameParts = (p?.name ?? "").trim().split(/\s+/);
  const stats = [
    { label: pt.perfil.bukysNaBolsa, value: s?.balance ?? 0, neon: true },
    { label: pt.perfil.totalBukys, value: s?.found_total ?? 0 },
    { label: pt.perfil.enviados, value: s?.sent_total ?? 0 },
    { label: pt.perfil.sorteios, value: counters?.sorteios ?? 0 },
    { label: pt.perfil.patrocinios, value: p?.campaigns_participated ?? 0 },
    { label: pt.perfil.passagens, value: s?.passes_valid_total ?? 0 },
  ];

  return (
    <div className="px-6 pt-[calc(env(safe-area-inset-top,0px)+30px)]">
      <div className="flex items-center justify-between">
        <p className="buky-label text-[var(--buky-neon)]">{pt.perfil.rotulo}</p>
        <button
          type="button"
          aria-label="Configurações"
          onClick={() => setMenu(true)}
          className="p-1 text-white"
        >
          <SlidersHorizontal size={22} />
        </button>
      </div>

      <Link to="/app/loja" className="mt-4 block rounded-xl border border-[var(--buky-line)] p-4">Loja 3buk ?</Link>
      <div className="mt-5 flex items-center gap-4">
        <ProfileAvatar size={84} to={null} />
        <div className="min-w-0">
          <h1 className="font-buky break-words text-[clamp(26px,8.5vw,34px)] leading-[0.95]">
            {nameParts[0]}
            {nameParts.length > 1 && (
              <>
                <br />
                {nameParts.slice(1).join(" ")}
              </>
            )}
          </h1>
          <p className="mt-2 truncate text-sm text-[var(--buky-muted)]">
            {[p?.neighborhood, city?.name].filter(Boolean).join(", ")}
            {p?.instagram && (
              <span className="font-semibold text-[var(--buky-neon)]">
                {" "}
                · @{p.instagram}
              </span>
            )}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 border-y border-[var(--buky-line)]">
        {stats.map((st, i) => (
          <div
            key={st.label}
            className={`py-3 ${i % 3 !== 2 ? "border-r border-[var(--buky-line)]" : ""} ${i % 3 ? "pl-3" : ""} ${i < 3 ? "border-b border-[var(--buky-line)]" : ""}`}
          >
            <dt className="text-[13px] text-[var(--buky-muted)]">{st.label}</dt>
            <dd
              className={`font-buky-xcond mt-1 text-[clamp(28px,8vw,36px)] leading-none ${st.neon ? "text-[var(--buky-neon)]" : ""}`}
            >
              {st.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px] leading-snug text-[var(--buky-muted)]">
        {pt.perfil.nota}
      </p>

      <Link
        to="/app/perfil/saldo"
        className="mt-5 flex items-center gap-3 rounded-[18px] border border-[var(--buky-line)] bg-[#111] p-4"
      >
        <Wallet size={20} className="shrink-0 text-[var(--buky-neon)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">
            {pt.saldo.perfilCard(brl(wallet?.balance_cents ?? 0))}
          </span>
          <span className="block truncate text-[12px] text-[var(--buky-muted)]">
            {wallet?.premium?.active && wallet.premium.until
              ? `Premium até ${fmtDate(wallet.premium.until, { day: "2-digit", month: "2-digit", year: "2-digit" })} · `
              : ""}
            {pt.saldo.perfilCardSub}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-[var(--buky-faint)]" />
      </Link>

      <div className="mt-5 rounded-[18px] border border-[var(--buky-line)] p-4">
        <label className="flex items-center justify-between gap-3">
          <span>{avisos.email}</span>
          <input
            type="checkbox"
            role="switch"
            checked={emailPref.data ?? false}
            disabled={emailPref.isLoading || !!emailPref.error || savingEmail}
            onChange={(e) => void setEmail(e.target.checked)}
          />
        </label>
        <p className="mt-2 text-xs text-[var(--buky-muted)]">
          {avisos.emailNota}
        </p>
        {emailPref.error && (
          <p className="text-sm">Não foi possível carregar a preferência.</p>
        )}
      </div>
      {sponsors.data && sponsors.data.length > 0 && (
        <Link className="mt-4 block text-[var(--buky-neon)]" to="/patrocinador">
          Painel do patrocinador →
        </Link>
      )}
      <section className="mt-7">
        <h2 className="buky-label text-[var(--buky-muted)]">
          {pt.perfil.historico}
        </h2>
        {isLoading ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <p className="py-6 text-sm text-[var(--buky-faint)]">
            {pt.perfil.semHistorico}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sessions.map((x) => (
              <HistoryCard key={x.id} x={x} name={p?.name ?? ""} />
            ))}
          </ul>
        )}
      </section>

      <Sheet open={menu} onClose={() => setMenu(false)} label="Configurações">
        <ul className="text-[16px]">
          <li>
            <Link
              to="/app/completar"
              state={{ edit: true }}
              className="flex items-center gap-3 py-4"
            >
              <Pencil size={18} className="text-[var(--buky-neon)]" />{" "}
              {pt.perfil.editar}
            </Link>
          </li>
          <li className="buky-row">
            <Link to="/app/rotas/nova" className="flex items-center gap-3 py-4">
              <Route size={18} className="text-[var(--buky-neon)]" />{" "}
              {pt.rota.titulo}
            </Link>
          </li>
          <li className="buky-row">
            <button
              type="button"
              className="flex w-full items-center gap-3 py-4 text-left"
              onClick={async () => {
                await logout();
                navigate("/entrar", { replace: true });
              }}
            >
              <LogOut size={18} className="text-[var(--buky-danger)]" />{" "}
              {pt.perfil.sair}
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}

const km = (m: number | null) => (m == null ? "–" : (m / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
function pace(v: number | null) {
  if (!v || v <= 0) return "–";
  const s = Math.round(3600 / v);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Tarjeta del historial con el formato de Strava (observación 5 del 7/11): quién, cuándo y dónde,
 * tipo de actividad, distancia, ritmo, tiempo y Bukys, y el croquis del recorrido. Abre el detalle.
 */
function HistoryCard({ x, name }: { x: SessionHistoryItem; name: string }) {
  const valid = x.status === "valid";
  const when = `${isToday(x.started_at) ? pt.perfil.hoje : fmtDate(x.started_at, { day: "2-digit", month: "long", year: "numeric" })} ${pt.perfil.as} ${fmtDate(x.started_at, { hour: "2-digit", minute: "2-digit" })}`;
  const place = x.start_city ?? x.city_name;
  return (
    <li>
      <Link to={`/app/perfil/treino/${x.id}`} className="block rounded-[20px] border border-[var(--buky-line)] bg-[#111] p-4 active:bg-[#151515]">
        <div className="flex items-center gap-3">
          <ProfileAvatar size={40} to={null} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{name || pt.perfil.voce}</p>
            <p className="truncate text-[12px] text-[var(--buky-muted)]">
              {when}
              {place ? ` · ${place}` : ""}
            </p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-[18px] font-semibold">
          <Footprints size={18} className="text-[var(--buky-neon)]" /> {x.route_name || pt.perfil.corrida}
        </p>
        {!valid && <p className="mt-1 text-[12px] text-[#ffb020]">{pt.perfil.invalido}</p>}
        <dl className="mt-3 grid grid-cols-[1.1fr_1fr_1fr_0.8fr] gap-2">
          {[
            { k: pt.perfil.distancia, v: km(x.distance_m), u: "km" },
            { k: pt.perfil.ritmo, v: pace(x.avg_speed_kmh), u: "/km" },
            { k: pt.perfil.tempo, v: x.duration_s == null ? "–" : fmtDuration(x.duration_s) },
            { k: "Bukys", v: `+${x.bukys_awarded}`, neon: valid },
          ].map((m) => (
            <div key={m.k} className="min-w-0">
              <dt className="truncate text-[10.5px] text-[var(--buky-muted)]">{m.k}</dt>
              <dd className={`truncate text-[16px] font-semibold tabular-nums ${m.neon ? "text-[var(--buky-neon)]" : ""}`}>
                {m.v}
                {m.u && m.v !== "–" && <span className="ml-0.5 text-[11px] font-normal text-[var(--buky-muted)]">{m.u}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <RouteSketch shape={x.shape} className="mt-3" />
      </Link>
      <ShareButton data={{ date: x.started_at, city: place ?? "", bukys: x.bukys_awarded, shape: x.shape, distance: x.distance_m, duration: x.duration_s, speed: x.avg_speed_kmh }} />
    </li>
  );
}
