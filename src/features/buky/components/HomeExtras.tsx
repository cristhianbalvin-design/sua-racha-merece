import { Trophy } from "lucide-react";
import { pt } from "../i18n";
import { useCityRanking, useSponsorshipWinners } from "../lib/hooks";
import type { SponsorWinner } from "../lib/api";

const I = pt.inicio;
const isVideo = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
const MEDAL = ["#ffd54a", "#c9d1d9", "#d39058"];

/**
 * Debajo del mapa en Início (observación 5 del 7/11): carrusel con quienes ya ganaron patrocinio y
 * el ranking de los 3 primeros de la ciudad (nombre corto, foto y Bukys recogidos corriendo).
 */
export default function HomeExtras({ cityCode }: { cityCode?: number | null }) {
  const { data: winners = [] } = useSponsorshipWinners();
  const { data: ranking } = useCityRanking(cityCode);

  return (
    <div className="space-y-7 pt-2">
      {winners.length > 0 && (
        <section aria-label={I.ganhadores}>
          <div className="flex items-baseline justify-between px-6">
            <h2 className="buky-label text-[var(--buky-neon)]">{I.ganhadores}</h2>
            <span className="text-[12px] text-[var(--buky-muted)]">{I.ganhadoresSub}</span>
          </div>
          <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none]">
            {winners.map((w, i) => (
              <WinnerCard key={`${w.name}-${i}`} w={w} />
            ))}
          </ul>
        </section>
      )}

      {ranking && (
        <section aria-label={I.ranking(ranking.city ?? "")} className="px-6">
          <h2 className="buky-label text-[var(--buky-neon)]">{I.ranking(ranking.city ?? "")}</h2>
          {ranking.top.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--buky-muted)]">{I.rankingVazio}</p>
          ) : (
            <ol className="mt-2">
              {ranking.top.map((r) => (
                <li key={`${r.pos}-${r.name}`} className={`buky-row flex items-center gap-3 py-3 ${r.me ? "text-[var(--buky-neon)]" : ""}`}>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-[#050505]"
                    style={{ background: MEDAL[r.pos - 1] ?? "#555" }}
                    aria-label={`${r.pos}º`}
                  >
                    {r.pos}
                  </span>
                  <Avatar url={r.avatar_url} name={r.name} />
                  <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                    {r.name}
                    {r.me && <span className="ml-1 text-[12px] font-normal text-[var(--buky-muted)]">({I.voce})</span>}
                  </span>
                  <span className="font-buky shrink-0 text-[22px] leading-none">{r.bukys}</span>
                </li>
              ))}
            </ol>
          )}
          {ranking.me && !ranking.top.some((r) => r.me) && (
            <p className="mt-2 rounded-xl bg-[#111] px-3 py-2.5 text-[13px] text-[var(--buky-muted)]">{I.suaPosicao(ranking.me.pos, ranking.me.bukys)}</p>
          )}
          <p className="mt-2 text-[12px] text-[var(--buky-faint)]">{I.rankingNota}</p>
        </section>
      )}
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1c1c1c] text-[14px] font-bold text-[var(--buky-muted)]">
      {name.slice(0, 1)}
    </span>
  );
}

function WinnerCard({ w }: { w: SponsorWinner }) {
  const img = w.media.find((u) => !isVideo(u));
  const video = !img ? w.media.find(isVideo) : undefined;
  return (
    <li className="w-[68%] max-w-[260px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[var(--buky-line)] bg-[#111]">
      <div className="relative aspect-[4/5] bg-[#1a1a1a]">
        {img ? (
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : video ? (
          <video src={video} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : w.avatar_url ? (
          <img src={w.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[var(--buky-neon)]">
            <Trophy size={40} />
          </span>
        )}
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[var(--buky-neon)] px-2 py-0.5 text-[11px] font-bold text-[#050505]">
          <Trophy size={12} /> {I.patrocinado}
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
          <p className="truncate text-[16px] font-semibold">{w.name}</p>
          {w.city && <p className="truncate text-[12px] text-[#cfcfcf]">{w.city}</p>}
        </div>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{w.prize ?? w.campaign}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--buky-muted)]">{w.campaign}</p>
      </div>
    </li>
  );
}
