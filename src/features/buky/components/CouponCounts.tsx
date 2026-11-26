import { Smartphone, Store } from "lucide-react";
import { useState } from "react";
import { countCouponKinds } from "../lib/raffleDisplay";

export function CouponCounts({ coupons }: { coupons: readonly { kind: "physical" | "digital" }[] }) {
  const counts = countCouponKinds(coupons);
  const [explanation, setExplanation] = useState<"physical" | "digital" | null>(null);
  return <div className="mt-2 text-xs">
    <div className="flex flex-wrap gap-2">
      <button type="button" className="flex items-center gap-1 rounded-full border border-[var(--buky-line)] px-2 py-1" onClick={() => setExplanation(explanation === "physical" ? null : "physical")}><Store size={14} /> {counts.physical} físicos</button>
      <button type="button" className="flex items-center gap-1 rounded-full border border-[var(--buky-line)] px-2 py-1" onClick={() => setExplanation(explanation === "digital" ? null : "digital")}><Smartphone size={14} /> {counts.digital} digitais</button>
    </div>
    {explanation && <p className="mt-1 text-[var(--buky-muted)]">{explanation === "physical" ? "Retire ou resgate no local com o QR." : "Use um código de desconto."}</p>}
  </div>;
}
