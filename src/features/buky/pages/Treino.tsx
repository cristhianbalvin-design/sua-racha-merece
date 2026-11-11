import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { Square, WifiOff } from "lucide-react";
import mascoteMini from "../assets/buky-mascote-mini.webp";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import CouponList from "../components/CouponList";
import { Sheet, Spinner } from "../components/ui";
import { getSettings } from "../lib/api";
import { useBukyProfile, useCouponsHere } from "../lib/hooks";
import { training, useTraining } from "../training/useTraining";
import { getGpsSource } from "../training/gpsSource";

/** Entrenamiento en curso (mockup "Entrenamiento en curso"). */
export default function Treino() {
  const navigate = useNavigate();
  const t = useTraining();
  const { data: profile } = useBukyProfile();
  const { coupons, away } = useCouponsHere(t.lastFix);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { data: speed } = useQuery({
    queryKey: ["buky", "speed-rules"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const s = await getSettings(["buky_speed_min_kmh", "buky_speed_max_kmh"]);
      return { min: s.buky_speed_min_kmh ?? 6, max: s.buky_speed_max_kmh ?? 25 };
    },
  });

  // Reloj del entrenamiento
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Aviso de bicicleta: vibración larga y cartel
  const [bikeWarn, setBikeWarn] = useState(0);
  useEffect(() => {
    training.setBikeListener((n) => {
      setBikeWarn(n);
      navigator.vibrate?.([400, 150, 400]);
    });
    return () => training.setBikeListener(null);
  }, []);

  // "+1 Buky" y vibración en cada pasada
  useEffect(() => {
    training.setPassListener(() => {
      setToast(pt.treino.maisUm);
      navigator.vibrate?.([60, 40, 60]);
      window.setTimeout(() => setToast(null), 2600);
    });
    return () => training.setPassListener(null);
  }, []);

  useEffect(() => {
    if (t.status === "done") navigate("/app/treino/resumo", { replace: true });
  }, [t.status, navigate]);

  const confirmedToday = t.rules.bukys_today ?? 0;

  const points = useMemo(
    () => t.points.map((p) => ({ ...p, state: t.visited.includes(p.id) ? ("visited" as const) : ("pending" as const) })),
    [t.points, t.visited],
  );

  if (t.status === "idle" || t.status === "error") return <Navigate to="/app" replace />;

  if (t.status === "closing" || t.status === "pending") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-8 text-center">
        <img src={mascoteMini} alt="" className="mb-6 h-28 w-auto" />
        {t.status === "closing" ? (
          <Spinner label={pt.treino.enviando} />
        ) : (
          <>
            <WifiOff className="mb-3 text-[var(--buky-neon)]" />
            <p className="text-[var(--buky-muted)]">{t.error === "offline" ? pt.treino.semConexao : pt.comum.erro}</p>
            <button type="button" className="buky-btn mt-8 max-w-[300px]" onClick={() => void training.sendPending()}>
              {pt.comum.tentarDeNovo}
            </button>
          </>
        )}
      </div>
    );
  }

  const live = t.passes.length;
  const remaining = t.points.length - t.visited.length;
  const elapsed = t.startedAt ? Math.max(0, Math.floor((now - t.startedAt) / 1000)) : 0;
  const v = t.speedKmh;
  const min = speed?.min ?? 6;
  const max = speed?.max ?? 25;
  const zone = v == null ? "none" : v < min ? "slow" : v > max ? "fast" : "ok";
  const maxS = t.rules.session_max_min * 60;
  const leftMin = Math.max(0, Math.ceil((maxS - elapsed) / 60));
  const speedTone = { none: "border-[var(--buky-line)]", ok: "border-[var(--buky-neon)]", slow: "border-[#ffb020]", fast: "border-[var(--buky-danger)]" }[zone];

  return (
    <div className="relative min-h-svh pb-[130px]">
      <div className="relative h-[44svh] min-h-[300px] overflow-hidden">
        <BukyMap
          center={t.lastFix ?? t.points[0] ?? null}
          zoom={16}
          points={points}
          path={t.path}
          showPath
          trail={t.track}
          user={t.lastFix}
          follow
          interactive={false}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--buky-bg)]" />
        <p className="absolute left-6 top-[calc(env(safe-area-inset-top,0px)+26px)] flex items-center gap-2 text-[13px] font-bold tracking-[0.12em]">
          <span className="buky-pulse h-3 w-3 rounded-full bg-[var(--buky-neon)]" /> {pt.treino.emCurso.toUpperCase()}
        </p>
        {t.weakGps && (
          <p className="absolute right-6 top-[calc(env(safe-area-inset-top,0px)+24px)] rounded-full bg-black/70 px-3 py-1 text-xs text-[#ffb020]">
            {pt.treino.gpsFraco}
          </p>
        )}
        {toast && (
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[#050505] shadow-lg" role="status">
            <img src={mascoteMini} alt="" className="h-7 w-7 rounded-full bg-[#050505] object-contain" />
            <span className="font-buky text-[17px]">{toast}</span>
          </div>
        )}
      </div>

      <div className="px-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="buky-label text-[var(--buky-muted)]">{pt.treino.bukysHoje}</p>
            <p className="font-buky-xcond mt-1 text-[clamp(72px,22vw,92px)] leading-none text-[var(--buky-neon)]" aria-live="polite">
              {confirmedToday + live}
            </p>
            {confirmedToday + live >= t.rules.daily_cap && <p className="text-sm">Limite de Bukys de hoje atingido.</p>}
          </div>
          <div className="mt-2 flex flex-col items-center">
            <button
              type="button"
              aria-label={pt.treino.terminar}
              onClick={() => setConfirmEnd(true)}
              className="flex h-[80px] w-[80px] items-center justify-center rounded-full bg-white text-[#050505] active:scale-95"
            >
              <Square size={26} fill="currentColor" />
            </button>
            <span className="font-buky mt-3 text-[15px]">{pt.treino.terminar}</span>
          </div>
        </div>
        {/* Distancia, tiempo y velocidad en vivo */}
        <div className="mt-3 grid grid-cols-3 gap-2.5" aria-live="off">
          <div className="rounded-2xl border border-[var(--buky-line)] bg-[#0d0d0d] px-3 py-2.5">
            <p className="buky-label text-[10px] text-[var(--buky-muted)]">{pt.treino.distancia}</p>
            <p className="font-buky mt-1 text-[26px] leading-none">{fmtKmLive(t.distanceM)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--buky-faint)]">km</p>
          </div>
          <div className="rounded-2xl border border-[var(--buky-line)] bg-[#0d0d0d] px-3 py-2.5">
            <p className="buky-label text-[10px] text-[var(--buky-muted)]">{pt.treino.tempo}</p>
            <p className="font-buky mt-1 text-[26px] leading-none tabular-nums">{fmtClock(elapsed)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--buky-faint)]">{elapsed >= 3600 ? "h:min:s" : "min:s"}</p>
          </div>
          <div className={`rounded-2xl border bg-[#0d0d0d] px-3 py-2.5 ${speedTone}`}>
            <p className="buky-label text-[10px] text-[var(--buky-muted)]">{pt.treino.velocidade}</p>
            <p className="font-buky mt-1 text-[26px] leading-none">{v == null ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</p>
            <p className={`mt-0.5 text-[11px] ${zone === "slow" ? "text-[#ffb020]" : zone === "fast" ? "text-[var(--buky-danger)]" : "text-[var(--buky-faint)]"}`}>
              {zone === "slow" ? pt.treino.devagar : zone === "fast" ? pt.treino.rapido : "km/h"}
            </p>
          </div>
        </div>
        {zone === "slow" && <p className="mt-2 text-[13px] text-[#ffb020]">{pt.treino.acelere(min)}</p>}
        {(bikeWarn > 0 || t.bikeWarnings > 0) && (
          <div className="mt-3 rounded-2xl border border-[var(--buky-danger)]/60 bg-[var(--buky-danger)]/10 p-3.5" role="alert">
            <p className="text-[15px] font-semibold text-[var(--buky-danger)]">
              {pt.treino.bikeAviso(Math.max(bikeWarn, t.bikeWarnings), t.rules.bike_warnings_to_stop)}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-[#f2c4c4]">{pt.treino.bikeAvisoTexto(t.rules.bike_warnings_to_stop)}</p>
          </div>
        )}
        <p className={`mt-2 text-[12px] ${leftMin <= 5 ? "text-[#ffb020]" : "text-[var(--buky-faint)]"}`}>
          {leftMin <= 5 ? pt.treino.restante(leftMin) : pt.treino.limite(t.rules.session_max_min)}
          {t.steps === false ? ` · ${pt.treino.semPassos}` : ""}
        </p>

        <p className="mt-4 text-[15px] text-[var(--buky-muted)]">
          {[pt.treino.coletados(live), pt.treino.perto(remaining), profile?.neighborhood].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-xs text-[var(--buky-faint)]">{t.routeName}</p>
        {t.error === "permission_denied" && (
          <div className="mt-4 rounded-2xl border border-[#ffb020]/40 p-4 text-sm text-[#ffd27a]" role="alert">
            {pt.treino.semPermissao}
            {getGpsSource().openSettings && (
              <button type="button" onClick={() => void getGpsSource().openSettings?.()} className="mt-2 block font-semibold text-[var(--buky-neon)]">
                {pt.treino.abrirAjustes}
              </button>
            )}
          </div>
        )}

        <div className="mt-8">
          <CouponList coupons={coupons} away={away} />
        </div>
      </div>

      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} label={pt.treino.terminar}>
        <h2 className="font-buky text-[36px]">{pt.treino.confirmarTerminar}</h2>
        <button
          type="button"
          className="buky-btn buky-btn-light mt-6"
          onClick={() => {
            setConfirmEnd(false);
            void training.finish();
          }}
        >
          {pt.treino.terminar}
        </button>
        <button type="button" className="mt-3 w-full py-3 text-sm text-[var(--buky-muted)]" onClick={() => setConfirmEnd(false)}>
          {pt.comum.cancelar}
        </button>
      </Sheet>
    </div>
  );
}

const fmtKmLive = (m: number) => (m / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtClock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
}
