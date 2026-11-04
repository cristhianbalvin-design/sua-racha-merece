import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { pt } from "../i18n";
import { ErrorBox, fmtDate, Sheet, Spinner } from "../components/ui";
import PrizeSheet, { PrizeRow, PrizeThumb } from "../components/PrizeSheet";
import SendToRaffleSheet from "../components/SendToRaffleSheet";
import type { MyPrize, PastRaffle, Prize, RafflePeriod } from "../lib/api";
import { fmtCountdown } from "../lib/countdown";
import { useMyRaffles, useSummary } from "../lib/hooks";

const S = pt.sorteios;
type Aba = "atual" | "proximos" | "resultados";
type Filtro = "todos" | "cidade" | "digitais";
const SHOW = 6;

const fmtDayTime = (iso: string) => fmtDate(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDay = (iso: string) => fmtDate(iso, { day: "2-digit", month: "2-digit" });

/**
 * Sorteios (opción A del cliente): pantalla propia, a la que se entra desde la Bolsa.
 * Atual: el periodo abierto, mi participación y los premios de mi zona (con filtros).
 * Próximos: los periodos programados y sus premios. Resultados: mis premios con código y los
 * sorteos anteriores, con resultados anónimos ("1 ganhador em Niterói").
 */
export default function Sorteios() {
  const [params, setParams] = useSearchParams();
  const aba = (["atual", "proximos", "resultados"].includes(params.get("aba") ?? "") ? params.get("aba") : "atual") as Aba;
  const { data, isLoading, isError, refetch } = useMyRaffles();
  const { data: summary } = useSummary();
  const balance = summary?.balance ?? 0;
  const [prize, setPrize] = useState<{ p: Prize; ctx: "atual" | "proximo"; opensAt?: string } | null>(null);
  const [past, setPast] = useState<PastRaffle | null>(null);
  const [confirm, setConfirm] = useState(false);

  const setAba = (a: Aba) => setParams(a === "atual" ? {} : { aba: a }, { replace: true });

  return (
    <div className="pb-6">
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+18px)]">
        <Link to="/app/bolsa" className="flex min-h-11 items-center gap-0.5 text-[14px] text-[var(--buky-muted)]">
          <ChevronLeft size={20} /> {S.voltar}
        </Link>
        <span className="text-[13px] text-[var(--buky-muted)]">
          {S.saldo} <b className="text-[var(--buky-neon)]">{balance}</b>
        </span>
      </header>
      <h1 className="font-buky mx-6 mt-1 text-[36px]">{S.titulo}</h1>

      <div role="tablist" aria-label={S.titulo} className="mx-6 mt-3 flex gap-2">
        {(["atual", "proximos", "resultados"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`h-10 flex-1 rounded-full text-[14px] font-semibold ${aba === a ? "bg-white text-[#050505]" : "border border-[var(--buky-line)] text-[var(--buky-muted)]"}`}
          >
            {S.abas[a]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner label={pt.comum.carregando} />
      ) : isError || !data ? (
        <ErrorBox message={pt.comum.erro} onRetry={() => refetch()} />
      ) : aba === "atual" ? (
        <Atual
          current={data.current}
          next={data.upcoming[0] ?? null}
          balance={balance}
          onSend={() => setConfirm(true)}
          onPrize={(p) => setPrize({ p, ctx: "atual" })}
          onProximos={() => setAba("proximos")}
        />
      ) : aba === "proximos" ? (
        <Proximos periods={data.upcoming} onPrize={(p, opensAt) => setPrize({ p, ctx: "proximo", opensAt })} />
      ) : (
        <Resultados mine={data.my_prizes} past={data.past} onOpen={setPast} />
      )}

      <PrizeSheet
        prize={prize?.p ?? null}
        onClose={() => setPrize(null)}
        footer={
          prize?.ctx === "proximo" ? (
            <p className="mt-5 rounded-2xl bg-[#111] p-3.5 text-[14px] text-[var(--buky-muted)]">{S.proximoAviso(fmtDayTime(prize.opensAt ?? ""))}</p>
          ) : data?.current ? (
            <>
              <p className="mt-5 rounded-2xl border border-[rgba(57,255,20,0.35)] bg-[rgba(57,255,20,0.08)] p-3.5 text-[14px] leading-snug">
                {data.current.my_bukys > 0 ? S.jaConcorre(data.current.my_bukys) : S.concorreEnviando}
              </p>
              {balance > 0 && data.current.status === "open" && (
                <button
                  type="button"
                  className="buky-btn mt-4"
                  onClick={() => {
                    setPrize(null);
                    setConfirm(true);
                  }}
                >
                  {data.current.my_bukys > 0 ? S.enviarMais(balance) : S.enviar(balance)}
                </button>
              )}
            </>
          ) : null
        }
      />

      <PastSheet raffle={past} onClose={() => setPast(null)} />
      <SendToRaffleSheet open={confirm} onClose={() => setConfirm(false)} balance={balance} prizes={data?.current?.prizes ?? []} />
    </div>
  );
}

function Atual({
  current,
  next,
  balance,
  onSend,
  onPrize,
  onProximos,
}: {
  current: RafflePeriod | null;
  next: RafflePeriod | null;
  balance: number;
  onSend: () => void;
  onPrize: (p: Prize) => void;
  onProximos: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [all, setAll] = useState(false);
  const prizes = current?.prizes ?? [];
  const counts = { todos: prizes.length, cidade: prizes.filter((p) => p.kind === "physical").length, digitais: prizes.filter((p) => p.kind === "digital").length };
  const list = useMemo(
    () => prizes.filter((p) => filtro === "todos" || (filtro === "cidade" ? p.kind === "physical" : p.kind === "digital")),
    [prizes, filtro],
  );

  if (!current) {
    return (
      <div className="mx-6 mt-6 rounded-[20px] border border-[var(--buky-line)] bg-[#111] p-5 text-center">
        <p className="text-[16px] font-semibold">{S.semAberto}</p>
        {next && <p className="mt-1 text-sm text-[var(--buky-muted)]">{S.semAbertoProximo(fmtDayTime(next.starts_at))}</p>}
        {next && (
          <button type="button" className="buky-btn buky-btn-ghost mt-4" onClick={onProximos}>
            {S.verProximos}
          </button>
        )}
      </div>
    );
  }

  const open = current.status === "open";
  return (
    <>
      <section aria-label={current.name} className="mx-6 mt-4 rounded-[20px] border border-[var(--buky-line)] bg-[#111] p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[16px] font-semibold">{current.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${open ? "bg-[var(--buky-neon)] text-[#050505]" : "border border-[#ffd27a]/50 text-[#ffd27a]"}`}>
            {open ? S.aberto.toUpperCase() : S.encerrado.split(" ·")[0].toUpperCase()}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-[var(--buky-muted)]">
          {open ? (
            <>
              {S.encerraEm("")}
              <b className="text-white">{fmtCountdown(current.ends_at)}</b> · {S.sorteioEm(fmtDayTime(current.draw_at))}
            </>
          ) : (
            <>
              {S.encerrado} · {S.sorteioEm(fmtDayTime(current.draw_at))}
            </>
          )}
        </p>
        <div className="mt-3.5 flex gap-3">
          <div className="flex-1 rounded-2xl bg-[var(--buky-bg)] px-3 py-2.5">
            <p className="font-buky text-[28px] leading-none text-[var(--buky-neon)]">{current.my_bukys}</p>
            <p className="mt-1 text-[12px] text-[var(--buky-muted)]">{S.bukysEnviados}</p>
          </div>
          <div className="flex-1 rounded-2xl bg-[var(--buky-bg)] px-3 py-2.5">
            <p className="font-buky text-[28px] leading-none">{current.my_tickets.length}</p>
            <p className="mt-1 text-[12px] text-[var(--buky-muted)]">{S.tickets}</p>
          </div>
        </div>
        {open &&
          (balance > 0 ? (
            <button type="button" className="buky-btn mt-3.5" onClick={onSend}>
              {S.enviar(balance)}
            </button>
          ) : (
            <p className="mt-3 text-center text-[13px] text-[var(--buky-muted)]">{S.semSaldo}</p>
          ))}
      </section>

      <div className="mx-6 mt-5 flex items-baseline justify-between">
        <p className="buky-label text-[var(--buky-neon)]">{S.premiosEmJogo(prizes.length)}</p>
        <p className="text-[12px] text-[var(--buky-muted)]">{S.valemTodos}</p>
      </div>
      {prizes.length === 0 ? (
        <p className="mx-6 mt-3 text-sm text-[var(--buky-faint)]">{S.semPremios}</p>
      ) : (
        <>
          <div className="mx-6 mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {(["todos", "cidade", "digitais"] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => {
                  setFiltro(f);
                  setAll(false);
                }}
                disabled={counts[f] === 0}
                className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold disabled:opacity-40 ${
                  filtro === f ? "border-[var(--buky-neon)] bg-[rgba(57,255,20,0.12)] text-[var(--buky-neon)]" : "border-[var(--buky-line)] text-[var(--buky-muted)]"
                }`}
              >
                {S.filtros[f]} {counts[f]}
              </button>
            ))}
          </div>
          <ul className="mx-6 mt-1">
            {(all ? list : list.slice(0, SHOW)).map((p) => (
              <PrizeRow key={p.id} prize={p} onOpen={() => onPrize(p)} />
            ))}
          </ul>
          {list.length > SHOW && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mx-6 mt-1 flex min-h-11 w-[calc(100%-48px)] items-center justify-center text-[14px] font-semibold text-[var(--buky-neon)]">
              {all ? S.verMenos : S.verTodos(list.length)}
            </button>
          )}
        </>
      )}
    </>
  );
}

function Proximos({ periods, onPrize }: { periods: RafflePeriod[]; onPrize: (p: Prize, opensAt: string) => void }) {
  if (periods.length === 0) return <p className="mx-6 mt-6 text-center text-sm text-[var(--buky-faint)]">{S.semProximos}</p>;
  return (
    <>
      {periods.map((p) => (
        <section key={p.id} aria-label={p.name} className="mx-6 mt-4">
          <div className="rounded-[20px] border border-[var(--buky-line)] bg-[#111] p-4">
            <p className="text-[16px] font-semibold">{p.name}</p>
            <p className="mt-1 text-[13px] text-[var(--buky-muted)]">
              {S.abreEm(fmtDayTime(p.starts_at))} · {S.sorteioEm(fmtDayTime(p.draw_at))}
            </p>
          </div>
          {p.prizes.length === 0 ? (
            <p className="mt-2 px-1 text-sm text-[var(--buky-faint)]">{S.semPremios}</p>
          ) : (
            <ul className="mt-1">
              {p.prizes.map((z) => (
                <PrizeRow key={z.id} prize={z} onOpen={() => onPrize(z, p.starts_at)} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

function MyPrizeCard({ p }: { p: MyPrize }) {
  const toRedeem = p.delivery_status === "pending" || p.delivery_status === "notified";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.redeem_code ?? "");
      toast.success(S.copiado);
    } catch {
      toast(p.redeem_code ?? "");
    }
  };
  return (
    <li className={`rounded-[20px] border p-4 ${toRedeem ? "border-[var(--buky-neon)] bg-[rgba(57,255,20,0.06)]" : "border-[var(--buky-line)]"}`}>
      <div className="flex items-start gap-3">
        <PrizeThumb prize={p} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold leading-tight">{p.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--buky-muted)]">
            {p.sponsor.name} · {p.period}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            toRedeem ? "border-[#ffd27a]/50 text-[#ffd27a]" : "border-[var(--buky-line)] text-[var(--buky-muted)]"
          }`}
        >
          {(S.entrega[p.delivery_status] ?? p.delivery_status).toUpperCase()}
        </span>
      </div>
      {p.redeem_code ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[var(--buky-bg)] px-3 py-2.5">
          <span className="font-mono text-[16px] tracking-wider">{p.redeem_code}</span>
          <button type="button" onClick={() => void copy()} className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--buky-line)] px-3 text-[13px] font-semibold">
            <Copy size={14} /> {S.copiar}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--buky-muted)]">{S.semCodigo}</p>
      )}
      {p.redeem_instructions && <p className="mt-2 text-[13px] leading-snug text-[#d9d9d9]">{p.redeem_instructions}</p>}
      <p className="mt-2 text-[12px] text-[var(--buky-faint)]">
        {[p.valid_until ? S.validoAte(fmtDay(`${p.valid_until}T12:00:00Z`)) : null, p.ticket ? `Ticket ${p.ticket}` : null].filter(Boolean).join(" · ")}
      </p>
    </li>
  );
}

function Resultados({ mine, past, onOpen }: { mine: MyPrize[]; past: PastRaffle[]; onOpen: (r: PastRaffle) => void }) {
  return (
    <>
      {mine.length > 0 && (
        <>
          <p className="buky-label mx-6 mt-5 text-[var(--buky-neon)]">{S.meusPremios(mine.length)}</p>
          <ul className="mx-6 mt-2.5 space-y-3">
            {mine.map((p) => (
              <MyPrizeCard key={p.result_id} p={p} />
            ))}
          </ul>
        </>
      )}
      <p className="buky-label mx-6 mt-6 text-[var(--buky-muted)]">{S.anteriores}</p>
      {past.length === 0 ? (
        <p className="mx-6 mt-3 text-sm text-[var(--buky-faint)]">{S.semAnteriores}</p>
      ) : (
        <ul className="mx-6 mt-1">
          {past.map((r) => (
            <li key={r.id} className="buky-row">
              <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center gap-3 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                  <span className="block truncate text-[12px] text-[var(--buky-muted)]">
                    {r.status === "cancelled"
                      ? S.cancelado
                      : [S.sorteado(fmtDay(r.drawn_at ?? r.draw_at)), S.premiosN(r.results.length), r.my_bukys > 0 ? S.voceEnviou(r.my_bukys) : S.naoParticipou].join(" · ")}
                  </span>
                </span>
                {r.status === "drawn" && r.my_bukys > 0 && (
                  <span className={`shrink-0 text-[12px] font-bold ${r.my_wins > 0 ? "text-[var(--buky-neon)]" : "text-[var(--buky-muted)]"}`}>
                    {r.my_wins > 0 ? S.ganhou(r.my_wins).toUpperCase() : S.naoGanhou}
                  </span>
                )}
                <ChevronRight size={16} className="shrink-0 text-[var(--buky-faint)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PastSheet({ raffle, onClose }: { raffle: PastRaffle | null; onClose: () => void }) {
  if (!raffle) return null;
  return (
    <Sheet open onClose={onClose} label={raffle.name}>
      <div className="max-h-[70svh] overflow-auto">
        <h2 className="text-[20px] font-bold">{raffle.name}</h2>
        <p className="mt-1 text-[13px] text-[var(--buky-muted)]">
          {raffle.status === "cancelled"
            ? S.cancelado
            : [S.sorteado(fmtDayTime(raffle.drawn_at ?? raffle.draw_at)), S.participantes(raffle.participants)].join(" · ")}
        </p>
        <p className="mt-3 rounded-2xl bg-[#111] p-3 text-[14px]">{raffle.my_bukys > 0 ? S.participouCom(raffle.my_bukys) : S.naoParticipouTexto}</p>
        <ul className="mt-2">
          {raffle.results.map((r) => (
            <li key={r.prize_id} className="buky-row flex items-center gap-3 py-3">
              <PrizeThumb prize={{ image_url: r.image_url, sponsor: { name: r.sponsor, logo_url: null, instagram: null, website: null } }} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{r.title}</span>
                <span className={`block truncate text-[12px] ${r.mine ? "font-bold text-[var(--buky-neon)]" : "text-[var(--buky-muted)]"}`}>
                  {r.mine ? S.voceGanhou : r.winners > 0 ? S.ganhadoresEm(r.winners, r.cities.join(", ")) : S.semGanhador}
                </span>
              </span>
              {r.benefit && <span className="font-buky shrink-0 text-[17px] text-[var(--buky-neon)]">{r.benefit}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-[var(--buky-faint)]">{S.resultadoTexto}</p>
      </div>
      <button type="button" onClick={onClose} className="mt-3 flex min-h-11 w-full items-center justify-center text-sm text-[var(--buky-muted)]">
        {S.fechar}
      </button>
    </Sheet>
  );
}
