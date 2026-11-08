import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiGetAvailableCampaigns } from "@/lib/mockApi";
import mascote from "../assets/buky-mascote.webp";
import { pt } from "../i18n";
import { ProfileAvatar, Sheet } from "../components/ui";
import { useMyStatus } from "../lib/hooks";

/**
 * Patrocínio (mockup 4): Kit 3buk activo (campañas existentes de 3BUK, ahora con su formulario
 * dentro de la app) y Premium bloqueado (decisión del cliente: todo gratis por ahora).
 * Si llega desde Fotos con una foto, la pasa a la campaña elegida.
 */
export default function Patrocinio() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [choose, setChoose] = useState(false);
  const { data: campaigns = [] } = useQuery({
    queryKey: ["buky", "campaigns-open"],
    queryFn: apiGetAvailableCampaigns,
    staleTime: 60_000,
  });
  const open = campaigns.filter((c) => !c.isHidden);
  const { data: st } = useMyStatus();
  // Fase 1: el patrocinio se libera con N Bukys recogidos corriendo (los testadores pasan)
  const falta = st && !st.tester ? Math.max(0, st.sponsorship_min - st.found_total) : 0;

  const participar = () => {
    if (falta > 0) return;
    if (open.length === 0) {
      toast(pt.patrocinio.semCampanha);
      return;
    }
    if (open.length === 1) navigate(`/app/patrocinio/${open[0].id}`, { state });
    else setChoose(true);
  };

  return (
    <div className="px-6 pt-[calc(env(safe-area-inset-top,0px)+30px)]">
      <div className="flex items-center justify-between">
        <p className="buky-label text-[var(--buky-neon)]">{pt.patrocinio.rotulo}</p>
        <ProfileAvatar />
      </div>

      <div className="relative mx-auto mt-1 flex h-[214px] w-[214px] items-end justify-center">
        <div className="absolute bottom-0 h-[164px] w-[164px] rounded-full bg-[var(--buky-neon)]" />
        <img src={mascote} alt="Buky" className="relative h-[210px] w-auto" />
      </div>

      <h1 className="font-buky mt-5 whitespace-nowrap text-center text-[36px]">
        {pt.patrocinio.t1}
        <br />
        <span className="text-[var(--buky-neon)]">{pt.patrocinio.t2}</span>
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="flex min-h-[200px] flex-col rounded-[22px] border border-[var(--buky-neon)] p-4">
          <p className="buky-label text-[11px] text-[var(--buky-neon)]">{pt.patrocinio.gratis}</p>
          <p className="mt-3 text-[15px] leading-snug">{pt.patrocinio.gratisTexto}</p>
          <div className="mt-auto">
            <p className="text-xs text-[var(--buky-faint)]">{pt.patrocinio.voceGanha}</p>
            <p className="font-buky mt-1 text-[28px] text-[var(--buky-neon)]">{pt.patrocinio.kit}</p>
          </div>
        </div>
        <div className="flex min-h-[200px] flex-col rounded-[22px] border border-dashed border-[#3a3a3a] p-4" aria-disabled="true">
          <p className="buky-label flex items-center justify-between text-[11px] text-[var(--buky-muted)]">
            {pt.patrocinio.premium} <Lock size={13} />
          </p>
          <p className="mt-3 text-[15px] leading-snug text-[var(--buky-muted)]">{pt.patrocinio.premiumTexto}</p>
          <div className="mt-auto">
            <p className="text-xs text-[var(--buky-faint)]">{pt.patrocinio.emBreve}</p>
            <p className="font-buky mt-1 text-[24px]">{pt.patrocinio.ticketCorrida}</p>
          </div>
        </div>
      </div>

      {falta > 0 && st ? (
        <div className="mt-6 rounded-[20px] border border-[var(--buky-line)] bg-[#111] p-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Lock size={15} className="text-[var(--buky-muted)]" /> {pt.patrocinio.bloqueado(st.sponsorship_min)}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1c1c1c]" role="progressbar" aria-valuemin={0} aria-valuemax={st.sponsorship_min} aria-valuenow={st.found_total}>
            <div className="h-full rounded-full bg-[var(--buky-neon)]" style={{ width: `${Math.min(100, (st.found_total / st.sponsorship_min) * 100)}%` }} />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-[var(--buky-muted)]">{pt.patrocinio.bloqueadoTexto(falta, st.sponsorship_min)}</p>
        </div>
      ) : (
        <button type="button" className="buky-btn mt-6" onClick={participar}>
          {pt.patrocinio.participar} <ArrowUpRight size={18} />
        </button>
      )}

      <Sheet open={choose} onClose={() => setChoose(false)} label={pt.patrocinio.escolha}>
        <p className="buky-label mb-3 text-[var(--buky-muted)]">{pt.patrocinio.escolha}</p>
        <ul className="-mx-2 max-h-[55svh] overflow-auto">
          {open.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => navigate(`/app/patrocinio/${c.id}`, { state })}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left hover:bg-[#161616]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-semibold">{c.name}</span>
                  <span className="block text-[13px] text-[var(--buky-muted)]">{[c.sport, c.city, c.prize].filter(Boolean).join(" · ")}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-[var(--buky-muted)]" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
