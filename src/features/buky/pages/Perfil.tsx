import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Pencil, Route, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { pt } from "../i18n";
import { fmtDate, isToday, ProfileAvatar, Sheet, Spinner } from "../components/ui";
import { useBukyProfile, useCity, useMySessions, useSummary } from "../lib/hooks";

/** Perfil (mockup 5): datos, 4 indicadores e historial de entrenamientos. */
export default function Perfil() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { data: p } = useBukyProfile();
  const { data: city } = useCity(p?.city_code);
  const { data: s } = useSummary();
  const { data: sessions = [], isLoading } = useMySessions();
  const [menu, setMenu] = useState(false);

  const nameParts = (p?.name ?? "").trim().split(/\s+/);
  const stats = [
    { label: pt.perfil.saldo, value: s?.balance ?? 0, neon: true },
    { label: pt.perfil.passagens, value: s?.passes_valid_total ?? 0 },
    { label: pt.perfil.enviados, value: s?.sent_total ?? 0 },
    { label: pt.perfil.participacoes, value: p?.campaigns_participated ?? 0 },
  ];

  return (
    <div className="px-6 pt-[calc(env(safe-area-inset-top,0px)+30px)]">
      <div className="flex items-center justify-between">
        <p className="buky-label text-[var(--buky-neon)]">{pt.perfil.rotulo}</p>
        <button type="button" aria-label="Configurações" onClick={() => setMenu(true)} className="p-1 text-white">
          <SlidersHorizontal size={22} />
        </button>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <ProfileAvatar size={108} to={null} />
        <div className="min-w-0">
          <h1 className="font-buky break-words text-[44px] leading-[0.9]">
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
            {p?.instagram && <span className="font-semibold text-[var(--buky-neon)]"> · @{p.instagram}</span>}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 border-y border-[var(--buky-line)]">
        {stats.map((st, i) => (
          <div key={st.label} className={`py-4 ${i % 2 === 0 ? "border-r border-[var(--buky-line)] pr-4" : "pl-5"} ${i < 2 ? "border-b border-[var(--buky-line)]" : ""}`}>
            <dt className="text-[13px] text-[var(--buky-muted)]">{st.label}</dt>
            <dd className={`font-buky-xcond mt-2 text-[56px] ${st.neon ? "text-[var(--buky-neon)]" : ""}`}>{st.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px] leading-snug text-[var(--buky-muted)]">{pt.perfil.nota}</p>

      <section className="mt-7">
        <h2 className="buky-label text-[var(--buky-muted)]">{pt.perfil.historico}</h2>
        {isLoading ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <p className="py-6 text-sm text-[var(--buky-faint)]">{pt.perfil.semHistorico}</p>
        ) : (
          <ul className="mt-2">
            {sessions.map((x) => (
              <li key={x.id} className="buky-row">
                <Link to={`/app/perfil/treino/${x.id}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[16px]">
                    {isToday(x.started_at) ? pt.perfil.hoje : fmtDate(x.started_at)} · {x.route_name}
                  </p>
                  <p className="text-[13px] text-[var(--buky-faint)]">
                    {[x.status === "valid" ? pt.perfil.waypoints(x.passes_valid) : pt.perfil.invalido, x.distance_m ? `${(x.distance_m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`font-buky text-[26px] ${x.status === "valid" ? "text-[var(--buky-neon)]" : "text-[var(--buky-faint)]"}`}>
                    +{x.bukys_awarded}
                  </span>
                  <ChevronRight size={16} className="text-[var(--buky-faint)]" />
                </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={menu} onClose={() => setMenu(false)} label="Configurações">
        <ul className="text-[16px]">
          <li>
            <Link to="/app/completar" state={{ edit: true }} className="flex items-center gap-3 py-4">
              <Pencil size={18} className="text-[var(--buky-neon)]" /> {pt.perfil.editar}
            </Link>
          </li>
          <li className="buky-row">
            <Link to="/app/rotas/nova" className="flex items-center gap-3 py-4">
              <Route size={18} className="text-[var(--buky-neon)]" /> {pt.rota.titulo}
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
              <LogOut size={18} className="text-[var(--buky-danger)]" /> {pt.perfil.sair}
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}
