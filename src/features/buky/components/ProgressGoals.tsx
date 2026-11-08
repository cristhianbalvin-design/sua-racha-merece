import { pt } from "../i18n";
import { useMyStatus } from "../lib/hooks";

/**
 * Fase 1 de la Matriz 2027: barras hacia el patrocinio (200) y la foto gratis (300). Cuentan solo
 * los Bukys recogidos corriendo (found_total), nunca los regalados.
 */
export default function ProgressGoals({ className = "" }: { className?: string }) {
  const { data: st } = useMyStatus();
  if (!st) return null;
  const goals = [
    { label: pt.bolsa.metaPatrocinio, min: st.sponsorship_min },
    { label: pt.bolsa.metaFoto, min: st.free_photo_min },
  ];
  return (
    <section className={className} aria-label={pt.bolsa.progresso}>
      <h2 className="buky-label py-2 text-[var(--buky-muted)]">{pt.bolsa.progresso}</h2>
      <ul className="space-y-3">
        {goals.map((g) => {
          const done = st.found_total >= g.min;
          const pct = Math.min(100, Math.round((st.found_total / Math.max(1, g.min)) * 100));
          return (
            <li key={g.label}>
              <div className="flex items-baseline justify-between text-[14px]">
                <span>{g.label}</span>
                <span className={done ? "font-semibold text-[var(--buky-neon)]" : "text-[var(--buky-muted)]"}>
                  {done ? pt.bolsa.liberado : `${st.found_total}/${g.min} · ${pt.bolsa.faltam(g.min - st.found_total)}`}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1c1c1c]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={g.min}
                aria-valuenow={Math.min(st.found_total, g.min)}
                aria-label={g.label}
              >
                <div className="h-full rounded-full bg-[var(--buky-neon)]" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-[var(--buky-faint)]">{pt.bolsa.progressoTexto}</p>
    </section>
  );
}
