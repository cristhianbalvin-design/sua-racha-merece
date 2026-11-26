import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PAYMENTS_ENABLED } from "@/config/features";
import { apiGetMyWallet } from "@/lib/walletApi";

export function isPremiumActive(active: boolean | undefined, until: string | null | undefined, now = Date.now()) {
  return Boolean(active && until && Number.isFinite(Date.parse(until)) && Date.parse(until) > now);
}

export default function PlanBadge({ plan, until, showUpgrade = false }: { plan: "Freemium" | "Premium"; until?: string | null; showUpgrade?: boolean }) {
  const premium = plan === "Premium" && (until === undefined || isPremiumActive(true, until));
  return <span className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold">
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${premium ? "bg-[#39ff14] text-black" : "bg-[#333] text-[#ddd]"}`}>
      {premium && <Crown size={14} />}{premium ? until ? `Premium até ${new Date(until).toLocaleDateString("pt-BR")}` : "Premium" : "Freemium"}
    </span>
    {!premium && showUpgrade && PAYMENTS_ENABLED && <Link className="text-[#39ff14] underline" to="/app/perfil/saldo">Virar Premium</Link>}
  </span>;
}

export function MyPlanBadge() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["wallet"], queryFn: apiGetMyWallet, enabled: Boolean(user), staleTime: 30_000 });
  if (!data) return null;
  return <PlanBadge plan={isPremiumActive(data.premium?.active, data.premium?.until) ? "Premium" : "Freemium"} until={data.premium?.until} showUpgrade />;
}
