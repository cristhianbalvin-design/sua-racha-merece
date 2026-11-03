import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiGetAvailableCampaigns } from "@/lib/mockApi";
import mascote from "../assets/buky-mascote.webp";
import { pt } from "../i18n";
import { ProfileAvatar } from "../components/ui";

/**
 * Patrocínio (mockup 4): Kit de Tribu activo (campañas existentes de 3BUK, formulario de
 * 4 evidencias) y Premium bloqueado (decisión del cliente: todo gratis por ahora).
 */
export default function Patrocinio() {
  const navigate = useNavigate();
  const { data: campaigns = [] } = useQuery({
    queryKey: ["buky", "campaigns-open"],
    queryFn: apiGetAvailableCampaigns,
    staleTime: 60_000,
  });
  const open = campaigns.filter((c) => !c.isHidden);

  const participar = () => {
    if (open.length === 0) {
      toast(pt.patrocinio.semCampanha);
      return;
    }
    navigate(open.length === 1 ? `/campanha/${open[0].id}` : "/campanhas");
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

      <button type="button" className="buky-btn mt-6" onClick={participar}>
        {pt.patrocinio.participar} <ArrowUpRight size={18} />
      </button>
    </div>
  );
}
