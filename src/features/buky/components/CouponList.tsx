import { pt } from "../i18n";
import type { ZoneCoupon } from "../lib/api";

/** Cupones de la zona del atleta: patrocinador, tipo y beneficio en grande (mockup). */
export default function CouponList({ coupons, title = true }: { coupons: ZoneCoupon[]; title?: boolean }) {
  if (coupons.length === 0) return null;
  return (
    <section aria-label={pt.treino.cupons}>
      {title && (
        <div className="flex items-center justify-between pb-3 text-[15px]">
          <span className="font-semibold">{pt.treino.cupons}</span>
          <span className="text-[var(--buky-faint)]">{coupons.length}</span>
        </div>
      )}
      <ul>
        {coupons.map((c) => (
          <li key={c.coupon_id} className="buky-row flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold">{c.sponsor_name}</p>
              <p className="truncate text-[13px] text-[var(--buky-faint)]">
                {c.kind === "physical" ? pt.treino.fisico : pt.treino.digital}
                {c.title ? ` · ${c.title}` : ""}
              </p>
            </div>
            <span className="font-buky shrink-0 text-right text-[32px] text-[var(--buky-neon)]">{c.benefit ?? ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
