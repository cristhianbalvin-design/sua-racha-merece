import { MoonStar, PersonStanding } from "lucide-react";
import { pt } from "../i18n";
import { getGpsSource } from "../training/gpsSource";
import { Sheet } from "./ui";

/** Aviso previo al inicio (decisión del cliente): "Não feche o app, apenas desligue a tela". */
export default function StartSheet({
  open,
  onClose,
  onStart,
  busy,
  routeName,
}: {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  busy: boolean;
  routeName: string;
}) {
  const background = getGpsSource().background;
  return (
    <Sheet open={open} onClose={onClose} label={pt.aviso.titulo}>
      <p className="buky-label text-[var(--buky-neon)]">{routeName}</p>
      <h2 className="font-buky mt-2 text-[44px]">{pt.aviso.titulo}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-snug text-[var(--buky-muted)]">
        <p className="flex gap-3">
          <MoonStar className="mt-0.5 shrink-0 text-[var(--buky-neon)]" size={20} />
          <span>{background ? pt.aviso.texto : pt.aviso.web}</span>
        </p>
        <p className="flex gap-3">
          <PersonStanding className="mt-0.5 shrink-0 text-[var(--buky-neon)]" size={20} />
          <span>{pt.aviso.caminhar}</span>
        </p>
      </div>
      <button type="button" className="buky-btn mt-7" onClick={onStart} disabled={busy}>
        {busy ? pt.comum.carregando : pt.aviso.comecar}
      </button>
      <button type="button" className="mt-3 w-full py-3 text-sm text-[var(--buky-muted)]" onClick={onClose}>
        {pt.aviso.cancelar}
      </button>
    </Sheet>
  );
}
