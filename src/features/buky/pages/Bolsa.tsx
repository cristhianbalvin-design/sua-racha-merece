import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import mascote from "../assets/buky-mascote.webp";
import { pt } from "../i18n";
import { fmtDate, ScreenHeader, Sheet, Spinner, ErrorBox } from "../components/ui";
import { BukyApiError } from "../lib/api";
import { useSendToRaffle, useSummary } from "../lib/hooks";

/** Bolsa (mockup 2): saldo, enviar al sorteo, último entrenamiento, ticket y movimientos en 3 totales. */
export default function Bolsa() {
  const { data: s, isLoading, isError, refetch } = useSummary();
  const send = useSendToRaffle();
  const [confirm, setConfirm] = useState(false);
  const keyRef = useRef<string | null>(null);

  if (isLoading) return <Spinner label={pt.comum.carregando} />;
  if (isError || !s) return <ErrorBox message={pt.comum.erro} onRetry={() => refetch()} />;

  const lastWin = s.wins[0];
  const lastTicket = s.open_period?.my_tickets.at(-1);

  const doSend = async () => {
    keyRef.current ??= crypto.randomUUID();
    try {
      const r = await send.mutateAsync(keyRef.current);
      keyRef.current = null;
      setConfirm(false);
      toast.success(pt.bolsa.enviado(r.ticket));
    } catch (e) {
      const code = (e as BukyApiError).code;
      // Con una respuesta del servidor el envío no ocurrió: la próxima vez usa otra clave.
      // Si falló la red, se conserva la clave: reintentar no duplica el envío.
      if (["no_open_period", "city_required", "no_bukys"].includes(code)) keyRef.current = null;
      setConfirm(false);
      toast.error(
        code === "no_open_period" ? pt.bolsa.semPeriodo : code === "city_required" ? pt.bolsa.semCidade : code === "no_bukys" ? pt.bolsa.semSaldo : pt.comum.erro,
      );
    }
  };

  return (
    <div>
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
        <button type="button" className="buky-btn" onClick={() => setConfirm(true)} disabled={s.balance < 1 || send.isPending}>
          {pt.bolsa.enviar}
        </button>
        <p className="mt-2.5 text-center text-xs text-[var(--buky-muted)]">{pt.bolsa.regra}</p>
      </div>

      <ul className="mt-6 px-6">
        {s.open_period && (
          <li className="buky-row flex items-center justify-between py-4 text-[15px]">
            <span>{pt.bolsa.sorteioAtual}</span>
            <span className="text-right text-[var(--buky-muted)]">
              {s.open_period.name}
              <span className="block text-xs text-[var(--buky-faint)]">
                {pt.bolsa.encerra(fmtDate(s.open_period.ends_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}
                {s.open_period.my_bukys > 0 && ` · ${pt.bolsa.participando}: ${s.open_period.my_bukys}`}
              </span>
            </span>
          </li>
        )}
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
        <li className="buky-row flex items-center justify-between py-4 text-[15px]">
          <span>{pt.bolsa.ticketGanho}</span>
          {lastWin ? (
            <span className="text-right">
              <span className="text-[var(--buky-muted)]">{lastWin.coupon} · </span>
              <span className="font-semibold text-[var(--buky-neon)]">{lastWin.ticket}</span>
              {lastWin.redeem_code && (
                <span className="block text-xs text-[var(--buky-muted)]">
                  {pt.bolsa.codigo}: <span className="font-mono text-white">{lastWin.redeem_code}</span>
                </span>
              )}
            </span>
          ) : lastTicket ? (
            <span className="text-[var(--buky-muted)]">
              {pt.bolsa.participando} · <span className="font-semibold text-[var(--buky-neon)]">{lastTicket}</span>
            </span>
          ) : (
            <span className="text-[var(--buky-faint)]">{pt.bolsa.nenhum}</span>
          )}
        </li>
      </ul>

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

      {s.wins.length > 1 && (
        <section className="mt-4 px-6">
          <h2 className="buky-label py-2 text-[var(--buky-muted)]">{pt.bolsa.premios}</h2>
          <ul>
            {s.wins.map((w, i) => (
              <li key={i} className="buky-row py-3 text-[15px]">
                <p className="flex justify-between">
                  <span>{w.coupon}</span>
                  <span className="text-[var(--buky-neon)]">{w.ticket}</span>
                </p>
                <p className="text-xs text-[var(--buky-faint)]">
                  {w.sponsor} · {w.period}
                  {w.redeem_code && ` · ${pt.bolsa.codigo} ${w.redeem_code}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} label={pt.bolsa.enviar}>
        <h2 className="font-buky text-[36px]">{pt.bolsa.enviar}</h2>
        <p className="mt-3 text-[15px] text-[var(--buky-muted)]">{pt.bolsa.confirmar(s.balance)}</p>
        <button type="button" className="buky-btn mt-6" onClick={doSend} disabled={send.isPending}>
          {send.isPending ? pt.comum.carregando : pt.comum.confirmar}
        </button>
        <button type="button" className="mt-3 w-full py-3 text-sm text-[var(--buky-muted)]" onClick={() => setConfirm(false)}>
          {pt.comum.cancelar}
        </button>
      </Sheet>
    </div>
  );
}
