import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Square, WifiOff } from "lucide-react";
import mascoteMini from "../assets/buky-mascote-mini.webp";
import { pt } from "../i18n";
import BukyMap from "../components/BukyMap";
import CouponList from "../components/CouponList";
import { isToday, Sheet, Spinner } from "../components/ui";
import { useBukyProfile, useCouponsHere, useMySessions } from "../lib/hooks";
import { training, useTraining } from "../training/useTraining";
import { getGpsSource } from "../training/gpsSource";

/** Entrenamiento en curso (mockup "Entrenamiento en curso"). */
export default function Treino() {
  const navigate = useNavigate();
  const t = useTraining();
  const { data: profile } = useBukyProfile();
  const { coupons, away } = useCouponsHere(t.lastFix);
  const { data: sessions = [] } = useMySessions();
  const [toast, setToast] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

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

  const confirmedToday = useMemo(
    () => sessions.filter((s) => s.status === "valid" && isToday(s.ended_at)).reduce((a, s) => a + s.bukys_awarded, 0),
    [sessions],
  );

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

  return (
    <div className="relative min-h-svh">
      <div className="relative h-[300px] overflow-hidden">
        <BukyMap center={t.lastFix ?? t.points[0] ?? null} zoom={15} points={points} path={t.path} user={t.lastFix} follow interactive={false} />
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
            <p className="font-buky-xcond mt-2 text-[150px] text-[var(--buky-neon)]" aria-live="polite">
              {confirmedToday + live}
            </p>
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
