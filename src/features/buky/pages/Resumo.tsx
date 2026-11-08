import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import mascote from "../assets/buky-mascote.webp";
import { pt } from "../i18n";
import { fmtDuration, fmtKm } from "../components/ui";
import { training, useTraining } from "../training/useTraining";

/** Resumen al terminar: lo que el servidor confirmó (o por qué no validó). */
export default function Resumo() {
  const t = useTraining();
  const qc = useQueryClient();

  useEffect(() => {
    if (t.status === "done") void qc.invalidateQueries({ queryKey: ["buky"] });
  }, [t.status, qc]);
  // Al salir del resumen, el entrenamiento vuelve a "sin iniciar"
  useEffect(() => () => training.reset(), []);

  if (t.status !== "done" || !t.result) return <Navigate to="/app" replace />;
  const r = t.result;
  const valid = r.status === "valid";
  const labels = new Map(t.points.map((p) => [p.id, p.label]));

  return (
    <div className="px-6 pt-[calc(env(safe-area-inset-top,0px)+28px)]">
      <p className="buky-label text-[var(--buky-neon)]">
        {pt.resumo.titulo} · {t.routeName}
      </p>
      <div className="relative mt-4 min-h-[220px]">
        <img src={mascote} alt="" className="absolute -right-4 top-0 h-[210px] w-auto opacity-95" />
        <p className="buky-label text-[var(--buky-muted)]">{valid ? pt.resumo.valido : pt.resumo.invalido}</p>
        <p className={`font-buky-xcond mt-2 text-[150px] ${valid ? "text-[var(--buky-neon)]" : "text-[var(--buky-faint)]"}`}>
          +{r.bukys}
        </p>
      </div>

      {!valid && (
        <p className="mt-2 flex gap-2 rounded-2xl border border-[var(--buky-line)] p-4 text-sm text-[var(--buky-muted)]">
          <CircleAlert size={18} className="shrink-0 text-[#ffb020]" />
          {pt.resumo.motivos[r.reason ?? "session_invalid"] ?? pt.resumo.motivos.session_invalid}
        </p>
      )}

      {valid && (r.stop_reason === "time_limit" || r.stop_reason === "bike") && (
        <p className="mt-2 flex gap-2 rounded-2xl border border-[var(--buky-line)] p-4 text-sm text-[var(--buky-muted)]" role="status">
          <CircleAlert size={18} className={`shrink-0 ${r.stop_reason === "bike" ? "text-[var(--buky-danger)]" : "text-[#ffb020]"}`} />
          <span>
            {pt.resumo.fim[r.stop_reason](t.rules.session_max_min)}
            {r.stop_reason === "bike" && <span className="mt-1 block text-[var(--buky-faint)]">{pt.resumo.bikeBloqueio}</span>}
          </span>
        </p>
      )}

      {r.stats && (
        <dl className="mt-6 grid grid-cols-3 border-y border-[var(--buky-line)] py-4 text-center">
          <div>
            <dt className="text-xs text-[var(--buky-faint)]">{pt.resumo.distancia}</dt>
            <dd className="font-buky mt-1 text-[26px]">{fmtKm(r.stats.distanceM)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--buky-faint)]">{pt.resumo.tempo}</dt>
            <dd className="font-buky mt-1 text-[26px]">{fmtDuration(r.stats.durationS)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--buky-faint)]">{pt.resumo.ritmo}</dt>
            <dd className="font-buky mt-1 text-[26px]">{r.stats.avgSpeedKmh} km/h</dd>
          </div>
        </dl>
      )}

      {r.passes && r.passes.length > 0 && (
        <section className="mt-6">
          <h2 className="buky-label text-[var(--buky-muted)]">{pt.resumo.passagens}</h2>
          <ul className="mt-2">
            {r.passes.map((p, i) => (
              <li key={i} className="buky-row flex items-center justify-between py-3 text-[15px]">
                <span>{labels.get(p.point_id) ?? "Waypoint"}</span>
                {(p.awarded ?? p.valid) ? (
                  <span className="font-buky text-[22px] text-[var(--buky-neon)]">+1</span>
                ) : (
                  <span className="text-sm text-[var(--buky-faint)]">{pt.resumo.rejeicoes[p.reject_reason ?? ""] ?? p.reject_reason}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 space-y-3">
        <Link to="/app/bolsa" className="buky-btn">
          {pt.resumo.irBolsa}
        </Link>
        <Link to="/app" className="block w-full py-3 text-center text-sm text-[var(--buky-muted)]">
          {pt.resumo.voltar}
        </Link>
      </div>
    </div>
  );
}
