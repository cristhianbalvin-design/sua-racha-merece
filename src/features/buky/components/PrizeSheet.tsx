import { Gift } from "lucide-react";
import { pt } from "../i18n";
import type { Prize } from "../lib/api";
import { fmtDate } from "./ui";

const S = pt.sorteios;

export function prizeZone(p: Pick<Prize, "scope" | "city" | "uf">) {
  return p.scope === "city" ? S.soCidade(p.city ?? "") : p.scope === "state" ? S.soEstado(p.uf ?? "") : S.brasil;
}

/** Foto del premio, o el logo del patrocinador, o un ícono. */
export function PrizeThumb({ prize, size = 44 }: { prize: Pick<Prize, "image_url" | "sponsor">; size?: number }) {
  const src = prize.image_url || prize.sponsor.logo_url;
  return src ? (
    <img src={src} alt="" loading="lazy" className="shrink-0 rounded-xl bg-[#1a1a1a] object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--buky-neon-soft)] text-[var(--buky-neon)]" style={{ width: size, height: size }}>
      <Gift size={size * 0.45} />
    </span>
  );
}

/** Fila compacta de un premio en las listas. */
export function PrizeRow({ prize, onOpen }: { prize: Prize; onOpen: () => void }) {
  return (
    <li className="buky-row">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-3 text-left">
        <PrizeThumb prize={prize} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{prize.title}</span>
          <span className="block truncate text-[12px] text-[var(--buky-muted)]">
            {prize.sponsor.name} · {prize.kind === "physical" ? "Físico" : "Digital"} · {S.ganhadores(prize.winners_count)}
          </span>
        </span>
        {prize.benefit && <span className="font-buky shrink-0 text-right text-[19px] leading-none text-[var(--buky-neon)]">{prize.benefit}</span>}
      </button>
    </li>
  );
}

/**
 * Detalle del premio (hoja inferior): foto, patrocinador, beneficio, alcance, ganadores, vigencia y
 * cómo canjearlo. `footer` lleva el aviso y el botón según el contexto (atual o próximo).
 */
export default function PrizeSheet({ prize, onClose, footer }: { prize: Prize | null; onClose: () => void; footer?: React.ReactNode }) {
  if (!prize) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" role="dialog" aria-modal="true" aria-label={prize.title} onClick={onClose}>
      <div
        className="max-h-[92svh] w-full max-w-[480px] overflow-auto rounded-t-[28px] border-t border-[var(--buky-line)] bg-[#0d0d0d] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#333]" />
        {prize.image_url ? (
          <img src={prize.image_url} alt="" className="h-[180px] w-full rounded-[18px] bg-[#1a1a1a] object-cover" />
        ) : (
          <div className="flex h-[120px] items-center justify-center rounded-[18px] bg-[var(--buky-neon-soft)] text-[var(--buky-neon)]">
            <Gift size={40} />
          </div>
        )}

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] text-[var(--buky-muted)]">
              {prize.sponsor.logo_url && <img src={prize.sponsor.logo_url} alt="" className="h-5 w-5 rounded-md object-cover" />}
              {prize.sponsor.name}
            </p>
            <h2 className="mt-1 text-[22px] font-bold leading-tight">{prize.title}</h2>
          </div>
          {prize.benefit && <p className="font-buky shrink-0 text-[32px] leading-none text-[var(--buky-neon)]">{prize.benefit}</p>}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            prize.kind === "physical" ? S.fisico : S.digital,
            prizeZone(prize),
            S.ganhadores(prize.winners_count),
            prize.valid_until ? S.validoAte(fmtDate(`${prize.valid_until}T12:00:00Z`, { day: "2-digit", month: "2-digit" })) : null,
          ]
            .filter(Boolean)
            .map((t) => (
              <span key={t} className="rounded-full bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] font-semibold">
                {t}
              </span>
            ))}
        </div>

        {prize.description && <p className="mt-4 text-[15px] leading-relaxed text-[#d9d9d9]">{prize.description}</p>}
        {prize.redeem_instructions && (
          <>
            <p className="buky-label mt-4 text-[var(--buky-muted)]">{S.comoResgatar}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#d9d9d9]">{prize.redeem_instructions}</p>
          </>
        )}

        {footer}
        <button type="button" onClick={onClose} className="mt-2 flex min-h-11 w-full items-center justify-center text-sm text-[var(--buky-muted)]">
          {S.fechar}
        </button>
      </div>
    </div>
  );
}
