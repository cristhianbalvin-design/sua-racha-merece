import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Gift, Ticket } from "lucide-react";
import mascote from "../assets/buky-mascote.webp";
import { pt } from "../i18n";
import { ScreenHeader, Spinner, ErrorBox } from "../components/ui";
import SendToRaffleSheet from "../components/SendToRaffleSheet";
import ProgressGoals from "../components/ProgressGoals";
import { fmtCountdown } from "../lib/countdown";
import { useMyRaffles, useSummary } from "../lib/hooks";

const S = pt.sorteios;

/**
 * Bolsa (mockup 2): solo el saldo de Bukys y sus movimientos. Todo lo del sorteo (premios, tickets,
 * resultados) vive en la pantalla Sorteios; aquí queda una tarjeta que lleva a ella.
 */
export default function Bolsa() {
  const { data: s, isLoading, isError, refetch } = useSummary();
  const { data: raffles } = useMyRaffles();
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return <Spinner label={pt.comum.carregando} />;
  if (isError || !s) return <ErrorBox message={pt.comum.erro} onRetry={() => refetch()} />;

  const current = raffles?.current ?? null;
  const toRedeem = (raffles?.my_prizes ?? []).filter((p) => p.delivery_status === "pending" || p.delivery_status === "notified").length;

  return (
    <div className="pb-4">
      <ScreenHeader title={pt.bolsa.titulo} />

      <div className="relative h-[244px]">
        <img src={mascote} alt="Buky" className="absolute -right-1 top-0 h-[236px] w-auto" />
        <p className="buky-label absolute left-6 top-3 text-[var(--buky-neon)]">{pt.bolsa.saldo}</p>
        <p className="font-buky-xcond absolute left-[18px] top-7 text-[176px]">{s.balance}</p>
        <p className="absolute left-[26px] top-[178px] text-[13px] font-bold tracking-[0.2em] text-[var(--buky-muted)]">
          {pt.bolsa.bukys.toUpperCase()}
        </p>
      </div>

      <div className="px-7">
        <button type="button" className="buky-btn" onClick={() => setConfirm(true)} disabled={s.balance < 1 || !s.open_period}>
          {pt.bolsa.enviar}
        </button>
        <p className="mt-2.5 text-center text-xs text-[var(--buky-muted)]">{s.open_period ? pt.bolsa.regra : pt.bolsa.semPeriodo}</p>
      </div>

      {/* Tarjeta del sorteio: lleva a la pantalla Sorteios */}
      <Link
        to="/app/bolsa/sorteios"
        className="mx-6 mt-6 flex items-center gap-3.5 rounded-[20px] border border-[var(--buky-neon)] bg-[rgba(57,255,20,0.06)] p-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--buky-neon-soft)] text-[var(--buky-neon)]">
          <Gift size={22} />
        </span>
        <span className="min-w-0 flex-1">
          {current ? (
            <>
              <span className="buky-label block text-[11px] text-[var(--buky-neon)]">
                {current.status === "open" ? S.cardAtual(fmtCountdown(current.ends_at)) : S.encerrado}
              </span>
              <span className="mt-1 block text-[16px] font-semibold">{S.cardPremios(current.prizes.length)}</span>
              <span className="mt-0.5 block text-[13px] text-[var(--buky-muted)]">{S.cardEnviados(current.my_bukys)}</span>
            </>
          ) : (
            <>
              <span className="block text-[16px] font-semibold">{S.cardSemAberto}</span>
              <span className="mt-0.5 block text-[13px] text-[var(--buky-muted)]">{S.cardSemAbertoSub}</span>
            </>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-[var(--buky-muted)]" />
      </Link>

      {toRedeem > 0 && (
        <Link to="/app/bolsa/sorteios?aba=resultados" className="mx-6 mt-3 flex items-center gap-3 rounded-2xl bg-[#111] px-4 py-3 text-[14px]">
          <Ticket size={18} className="shrink-0 text-[#ffd27a]" />
          <span className="flex-1">{S.premioParaResgatar(toRedeem)}</span>
          <ChevronRight size={16} className="text-[var(--buky-faint)]" />
        </Link>
      )}

      <ul className="mt-4 px-6">
        <li className="buky-row">
          <Link to="/app/perfil" className="flex items-center justify-between py-4 text-[15px]">
            <span>{pt.bolsa.ultimoTreino}</span>
            {s.last_session ? (
              <span className="flex items-center gap-2">
                <span className={`font-buky text-[22px] ${s.last_session.status === "valid" ? "text-[var(--buky-neon)]" : "text-[var(--buky-faint)]"}`}>
                  +{s.last_session.bukys}
                </span>
                <span className="text-[var(--buky-muted)]">{s.last_session.route}</span>
                <ChevronRight size={16} className="text-[var(--buky-faint)]" />
              </span>
            ) : (
              <span className="text-[var(--buky-faint)]">{pt.bolsa.nenhum}</span>
            )}
          </Link>
        </li>
      </ul>

      <ProgressGoals className="mt-4 px-6" />

      <section className="mt-4 px-6">
        <h2 className="buky-label py-2 text-[var(--buky-muted)]">{pt.bolsa.movimentos}</h2>
        <ul>
          {[
            { v: s.found_total, sign: "+", label: pt.bolsa.encontrados, neon: true },
            { v: s.gift_total, sign: "+", label: pt.bolsa.presenteados, neon: true },
            { v: s.sent_total, sign: "−", label: pt.bolsa.enviados, neon: false },
          ].map((m) => (
            <li key={m.label} className="buky-row flex items-center gap-4 py-3.5 text-[15px]">
              <span className={`font-buky w-12 text-[22px] ${m.neon ? "text-[var(--buky-neon)]" : "text-[var(--buky-muted)]"}`}>
                {m.v > 0 ? `${m.sign}${m.v}` : "0"}
              </span>
              <span>{m.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <SendToRaffleSheet open={confirm} onClose={() => setConfirm(false)} balance={s.balance} prizes={current?.prizes ?? []} />
    </div>
  );
}
