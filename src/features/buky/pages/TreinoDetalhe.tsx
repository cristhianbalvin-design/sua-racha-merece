import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, CircleAlert } from "lucide-react";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import { ErrorBox, fmtDate, fmtDuration, Spinner } from "../components/ui";
import { getSessionDetail, getSessionTrack } from "../lib/api";
import { LiveStats } from "../training/liveStats";

const H = pt.historico;

const kmh = (v: number | null) => (v == null ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const km = (m: number | null) => (m == null ? "–" : (m / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** Ritmo en min/km a partir de km/h. */
function pace(v: number | null) {
  if (!v || v <= 0) return "–";
  const s = Math.round(3600 / v);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Historial de un entrenamiento: el recorrido real en el mapa (blanco) sobre la ruta (verde), los
 * Bukys recogidos y los que no, y distancia, duración, velocidades y ritmo. El recorrido se lee del
 * archivo privado del atleta (paso 22); si no se puede, se muestran igual las métricas.
 */
export default function TreinoDetalhe() {
  const { id = "" } = useParams();
  const { data: s, isLoading, isError, refetch } = useQuery({ queryKey: ["buky", "session", id], queryFn: () => getSessionDetail(id), staleTime: Infinity });
  const { data: readings, isError: trackError } = useQuery({
    queryKey: ["buky", "track", s?.track_path],
    queryFn: () => getSessionTrack(s!.track_path!),
    enabled: Boolean(s?.track_path),
    staleTime: Infinity,
    retry: false,
  });

  // Recorrido limpio (solo lecturas precisas, sin el temblor de estar quieto)
  const track = useMemo(() => {
    if (!readings) return [];
    const live = new LiveStats();
    for (const r of readings) if (r.acc <= 25) live.add(r.lat, r.lon, r.t);
    return live.snapshot().track;
  }, [readings]);

  if (isLoading) return <Spinner label={pt.comum.carregando} />;
  if (isError || !s) return <ErrorBox message={pt.comum.erro} onRetry={() => refetch()} />;

  const awarded = new Set(s.passes.filter((p) => p.awarded).map((p) => p.point_id));
  const points = (s.route?.points ?? []).map((p) => ({ ...p, state: awarded.has(p.id) ? ("visited" as const) : ("pending" as const) }));
  const labels = new Map((s.route?.points ?? []).map((p) => [p.id, p.label]));
  const valid = s.status === "valid";
  const fitTo = track.length > 1 ? track : s.route?.path ?? s.route?.points ?? [];
  const time = (iso: string) => fmtDate(iso, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="pb-[130px]">
      <div className="relative h-[46svh] min-h-[300px] overflow-hidden">
        <BukyMap center={fitTo[0] ?? null} zoom={15} points={points} path={s.route?.path} showPath trail={track} fitTo={fitTo} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[var(--buky-bg)]" />
        <Link
          to="/app/perfil"
          aria-label={pt.comum.voltar}
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-10 w-10 items-center justify-center rounded-full bg-black/75"
        >
          <ChevronLeft size={22} />
        </Link>
      </div>

      <div className="px-6">
        <p className="buky-label text-[var(--buky-neon)]">
          {fmtDate(s.started_at, { weekday: "short", day: "2-digit", month: "2-digit" })} · {time(s.started_at)}
          {s.ended_at ? `–${time(s.ended_at)}` : ""}
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="min-w-0 truncate text-[22px] font-bold">{s.route?.name ?? H.rotaRemovida}</h1>
          <p className={`font-buky shrink-0 text-[40px] leading-none ${valid ? "text-[var(--buky-neon)]" : "text-[var(--buky-faint)]"}`}>+{s.bukys_awarded}</p>
        </div>
        <p className="mt-1 text-[13px] text-[var(--buky-muted)]">
          {valid ? H.bukysConfirmados(s.bukys_awarded, s.route?.points.length ?? 0) : pt.resumo.invalido}
        </p>

        {!valid && (
          <p className="mt-3 flex gap-2 rounded-2xl border border-[var(--buky-line)] p-3.5 text-sm text-[var(--buky-muted)]">
            <CircleAlert size={18} className="shrink-0 text-[#ffb020]" />
            {pt.resumo.motivos[s.invalid_reason ?? "session_invalid"] ?? pt.resumo.motivos.session_invalid}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2.5">
          {[
            { k: H.distancia, v: km(s.distance_m), u: "km" },
            { k: H.duracao, v: s.duration_s == null ? "–" : fmtDuration(s.duration_s), u: s.duration_s != null && s.duration_s >= 3600 ? "h" : "min:s" },
            { k: H.ritmo, v: pace(s.avg_speed_kmh), u: "min/km" },
            { k: H.passagens, v: String(s.passes_valid), u: H.validas },
          ].map((m) => (
            <div key={m.k} className="rounded-2xl border border-[var(--buky-line)] bg-[#0d0d0d] px-3 py-2.5">
              <dt className="buky-label text-[10px] text-[var(--buky-muted)]">{m.k}</dt>
              <dd className="font-buky mt-1 text-[24px] leading-none">{m.v}</dd>
              <dd className="mt-0.5 text-[11px] text-[var(--buky-faint)]">{m.u}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--buky-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded-full bg-white" /> {H.legendaRecorrido}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded-full bg-[var(--buky-neon)] opacity-60" /> {H.legendaRota}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[var(--buky-neon)]" /> {H.legendaPego}
          </span>
        </div>
        {s.track_path == null ? (
          <p className="mt-2 text-xs text-[var(--buky-faint)]">{H.semRecorrido}</p>
        ) : trackError ? (
          <p className="mt-2 text-xs text-[var(--buky-faint)]">{H.erroRecorrido}</p>
        ) : null}

        {s.passes.length > 0 && (
          <section className="mt-6">
            <h2 className="buky-label text-[var(--buky-muted)]">{pt.resumo.passagens}</h2>
            <ul className="mt-2">
              {s.passes.map((p, i) => (
                <li key={i} className="buky-row flex items-center justify-between gap-3 py-3 text-[15px]">
                  <span className="min-w-0">
                    <span className="block truncate">{labels.get(p.point_id) ?? "Waypoint"}</span>
                    <span className="block text-[12px] text-[var(--buky-faint)]">
                      {fmtDate(p.passed_at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      {p.speed_kmh != null ? ` · ${kmh(Number(p.speed_kmh))} km/h` : ""}
                    </span>
                  </span>
                  {p.awarded ? (
                    <span className="font-buky text-[22px] text-[var(--buky-neon)]">+1</span>
                  ) : (
                    <span className="text-right text-sm text-[var(--buky-faint)]">{pt.resumo.rejeicoes[p.reject_reason ?? ""] ?? p.reject_reason ?? "—"}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
