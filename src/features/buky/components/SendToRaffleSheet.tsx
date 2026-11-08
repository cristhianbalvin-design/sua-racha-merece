import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { pt } from "../i18n";
import type { BukyApiError, RafflePeriod } from "../lib/api";
import { useSendToRaffle } from "../lib/hooks";
import { Sheet } from "./ui";

const S = pt.sorteios;

/**
 * Enviar Bukys a UN sorteo elegido (paso 25): el atleta elige cuántos, lee y acepta el reglamento,
 * y el servidor confirma con su ubicación que el sorteo vale donde está. La clave de idempotencia se
 * conserva si falla la red: reintentar no duplica el envío.
 */
export default function SendToRaffleSheet({
  period,
  balance,
  pos,
  onClose,
}: {
  period: RafflePeriod | null;
  balance: number;
  pos: { lat: number; lon: number } | null;
  onClose: () => void;
}) {
  const send = useSendToRaffle();
  const keyRef = useRef<string | null>(null);
  const [amount, setAmount] = useState(balance);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!period) return;
    setAmount(balance);
    setAccepted(Boolean(period.rules?.accepted));
    keyRef.current = null;
  }, [period?.id, balance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!period) return null;
  const rules = period.rules ?? { version: 1, text: "", provisional: true, accepted: false };
  const clamp = (n: number) => Math.max(1, Math.min(balance, Math.round(n)));

  const doSend = async () => {
    keyRef.current ??= crypto.randomUUID();
    try {
      const r = await send.mutateAsync({
        periodId: period.id,
        amount,
        lat: pos?.lat ?? null,
        lon: pos?.lon ?? null,
        rulesVersion: rules.version,
        idempotencyKey: keyRef.current,
      });
      keyRef.current = null;
      onClose();
      toast.success(S.enviado(r.amount, r.ticket));
    } catch (e) {
      const code = (e as BukyApiError).code;
      // Con respuesta del servidor el envío no ocurrió: la próxima vez usa otra clave.
      if (code in S.erros) keyRef.current = null;
      toast.error(S.erros[code] ?? pt.comum.erro);
      if (code !== "rules_not_accepted") onClose();
    }
  };

  return (
    <Sheet open onClose={onClose} label={period.name}>
      <div className="max-h-[78svh] overflow-auto">
        <p className="buky-label text-[var(--buky-neon)]">{period.name}</p>
        <h2 className="font-buky mt-1 text-[32px] leading-none">{S.escolhaQuantos}</h2>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="−"
            onClick={() => setAmount((a) => clamp(a - 1))}
            disabled={amount <= 1}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--buky-line)] disabled:opacity-40"
          >
            <Minus size={20} />
          </button>
          <p className="font-buky-xcond text-center text-[88px] leading-none text-[var(--buky-neon)]" aria-live="polite">
            {amount}
          </p>
          <button
            type="button"
            aria-label="+"
            onClick={() => setAmount((a) => clamp(a + 1))}
            disabled={amount >= balance}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--buky-line)] disabled:opacity-40"
          >
            <Plus size={20} />
          </button>
        </div>
        <input
          type="range"
          min={1}
          max={Math.max(1, balance)}
          value={amount}
          onChange={(e) => setAmount(clamp(Number(e.target.value)))}
          aria-label={S.escolhaQuantos}
          className="mt-3 w-full accent-[var(--buky-neon)]"
        />
        <div className="mt-2 flex gap-2">
          {[
            { label: S.metade, v: Math.ceil(balance / 2) },
            { label: `${S.tudo} (${balance})`, v: balance },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setAmount(clamp(c.v))}
              aria-pressed={amount === c.v}
              className={`h-9 flex-1 rounded-full border text-[13px] font-semibold ${
                amount === c.v ? "border-[var(--buky-neon)] text-[var(--buky-neon)]" : "border-[var(--buky-line)] text-[var(--buky-muted)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-snug text-[var(--buky-muted)]">{S.consumidos}</p>

        <div className="mt-4 rounded-2xl border border-[var(--buky-line)] bg-[#0d0d0d] p-3">
          <p className="flex items-center justify-between text-[13px] font-semibold">
            {S.regulamento}
            {rules.provisional && <span className="rounded-full border border-[#ffd27a]/50 px-2 py-0.5 text-[10px] text-[#ffd27a]">{S.regulamentoProvisorio}</span>}
          </p>
          <p className="mt-2 max-h-[22svh] overflow-auto whitespace-pre-line text-[12px] leading-relaxed text-[var(--buky-muted)]">{rules.text}</p>
        </div>
        {!rules.accepted && period.my_bukys > 0 && <p className="mt-2 text-[12px] text-[#ffd27a]">{S.regulamentoNovo}</p>}
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="h-5 w-5 accent-[var(--buky-neon)]" />
          {S.aceito}
        </label>
      </div>

      <button type="button" className="buky-btn mt-4" onClick={doSend} disabled={send.isPending || !accepted || balance < 1}>
        {send.isPending ? pt.comum.carregando : S.confirmarEnvio(amount)}
      </button>
      <button type="button" className="mt-2 w-full py-3 text-sm text-[var(--buky-muted)]" onClick={onClose}>
        {pt.comum.cancelar}
      </button>
    </Sheet>
  );
}
