import { useRef } from "react";
import { toast } from "sonner";
import { pt } from "../i18n";
import type { BukyApiError, Prize } from "../lib/api";
import { useSendToRaffle } from "../lib/hooks";
import { Sheet } from "./ui";

/**
 * Confirmación de "Enviar ao sorteio" (Bolsa y Sorteios). Envía TODO el saldo al sorteio abierto.
 * La clave de idempotencia se conserva si falla la red: reintentar no duplica el envío.
 */
export default function SendToRaffleSheet({
  open,
  onClose,
  balance,
  prizes,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
  prizes: Prize[];
}) {
  const send = useSendToRaffle();
  const keyRef = useRef<string | null>(null);

  const doSend = async () => {
    keyRef.current ??= crypto.randomUUID();
    try {
      const r = await send.mutateAsync(keyRef.current);
      keyRef.current = null;
      onClose();
      toast.success(pt.bolsa.enviado(r.ticket));
    } catch (e) {
      const code = (e as BukyApiError).code;
      // Con respuesta del servidor el envío no ocurrió: la próxima vez usa otra clave.
      if (["no_open_period", "city_required", "no_bukys"].includes(code)) keyRef.current = null;
      onClose();
      toast.error(
        code === "no_open_period" ? pt.bolsa.semPeriodo : code === "city_required" ? pt.bolsa.semCidade : code === "no_bukys" ? pt.bolsa.semSaldo : pt.comum.erro,
      );
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={pt.bolsa.enviar}>
      <h2 className="font-buky text-[36px]">{pt.bolsa.enviar}</h2>
      <p className="mt-3 text-[15px] text-[var(--buky-muted)]">{pt.bolsa.confirmar(balance)}</p>
      {prizes.length > 0 && (
        <p className="mt-2 text-[15px]">
          {pt.bolsa.concorre(prizes.length)}{" "}
          <span className="text-[var(--buky-muted)]">
            {prizes
              .slice(0, 4)
              .map((c) => c.title)
              .join(" · ")}
            {prizes.length > 4 ? " …" : ""}
          </span>
        </p>
      )}
      <button type="button" className="buky-btn mt-6" onClick={doSend} disabled={send.isPending}>
        {send.isPending ? pt.comum.carregando : pt.comum.confirmar}
      </button>
      <button type="button" className="mt-3 w-full py-3 text-sm text-[var(--buky-muted)]" onClick={onClose}>
        {pt.comum.cancelar}
      </button>
    </Sheet>
  );
}
