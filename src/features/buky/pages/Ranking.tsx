import { useState } from "react";
import { Link } from "react-router-dom";
import { useBukyProfile, useRankingPage } from "../lib/hooks";
import { ErrorBox, Spinner } from "../components/ui";
import { pt } from "../i18n";

export default function Ranking() {
  const [scope, setScope] = useState<"city" | "national">("city");
  const [month, setMonth] = useState<string | null>(null);
  const { data: profile } = useBukyProfile();
  const page = useRankingPage(scope, profile?.city_code ?? null, month);
  const first = page.data?.pages[0];
  const rows = page.data?.pages.flatMap((p) => p.items) ?? [];
  const selected = month ?? first?.period;
  return <main className="px-6 pb-8 pt-[calc(env(safe-area-inset-top,0px)+24px)]">
    <Link to="/app" className="text-sm text-[var(--buky-neon)]">← Início</Link>
    <h1 className="font-buky mt-4 text-4xl">{pt.ranking.titulo}</h1>
    <div className="mt-4 flex gap-2" role="tablist" aria-label="Âmbito do ranking">
      {(["city", "national"] as const).map((value) => <button key={value} role="tab" aria-selected={scope === value} onClick={() => { setScope(value); setMonth(null); }} className={`rounded-full px-4 py-2 text-sm ${scope === value ? "bg-[var(--buky-neon)] text-black" : "border border-[var(--buky-line)]"}`}>{value === "city" ? pt.ranking.cidade : pt.ranking.nacional}</button>)}
    </div>
    {page.isLoading ? <Spinner label={pt.comum.carregando} /> : page.isError ? <ErrorBox message={pt.comum.erro} onRetry={() => page.refetch()} /> : first && <>
      <label className="mt-5 block text-sm">{pt.ranking.mes}
        <select value={selected ?? ""} onChange={(e) => { setMonth(e.target.value); }} className="mt-1 block w-full rounded-xl border border-[var(--buky-line)] bg-[#111] p-3 text-white">
          {[...new Set([first.period, ...first.months])].map((m) => <option key={m} value={m}>{new Date(`${m}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
        </select>
      </label>
      {first.city && <p className="mt-3 text-sm text-[var(--buky-muted)]">{first.city}</p>}
      {rows.length === 0 ? <p className="mt-5 text-sm text-[var(--buky-muted)]">{pt.ranking.vazio}</p> : <ol className="mt-4 divide-y divide-[var(--buky-line)]">{rows.map((r, i) => <li key={`${r.pos}-${r.nickname}-${i}`} className={`flex items-center gap-3 py-3 ${r.me ? "text-[var(--buky-neon)]" : ""}`}><span className="w-8 font-bold">{r.pos}º</span>{r.avatar_url && <img src={r.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />}<span className="min-w-0 flex-1 truncate">{r.initials}{r.nickname && ` · @${r.nickname}`}{r.me && " · Você"}</span><b>{r.bukys}</b></li>)}</ol>}
      {first.me && !rows.some((r) => r.me) && <p className="mt-3 rounded-xl bg-[#111] p-3 text-[var(--buky-neon)]">{pt.ranking.suaPosicao(first.me.pos, first.me.bukys)}</p>}
      {page.hasNextPage && <button type="button" className="mt-4 rounded-full border px-4 py-2" disabled={page.isFetchingNextPage} onClick={() => page.fetchNextPage()}>Ver mais</button>}
    </>}
  </main>;
}
