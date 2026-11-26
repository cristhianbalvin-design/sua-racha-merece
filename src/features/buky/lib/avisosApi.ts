import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export type Aviso = { id: string; type: string; title: string; message: string; read: boolean; created_at: string };
export function isVisible(type: string, rules: { kind: string; visible: boolean }[]) {
  return rules.find((rule) => rule.kind === type)?.visible ?? true;
}
export function groupAvisos(notices: Aviso[]) {
  return notices.reduce<Record<string, Aviso[]>>((groups, notice) => {
    const date = new Date(notice.created_at).toLocaleDateString("pt-BR");
    (groups[date] ??= []).push(notice);
    return groups;
  }, {});
}
export function avisoLabel(type: string) {
  if (type.startsWith("premium_")) return "Premium";
  if (type.startsWith("buky_raffle_") || type.startsWith("buky_prize_")) return "Sorteio";
  if (type.startsWith("wallet_")) return "Saldo";
  return "Aviso";
}
export function useAvisos(limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["buky-avisos", user?.id, limit], enabled: !!user?.id, refetchInterval: 60000,
    queryFn: async () => {
      const visibility = await supabase.rpc("my_notification_visibility");
      if (visibility.error) throw visibility.error;
      const hidden = (visibility.data as { kind: string; visible: boolean }[]).filter((r) => !r.visible).map((r) => r.kind);
      let request = supabase.from("notifications").select("id,type,title,message,read,created_at")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).order("id");
      if (hidden.length) request = request.not("type", "in", `(${hidden.join(",")})`);
      const { data, error } = await request.limit(limit);
      if (error) throw error;
      return (data as Aviso[]).filter((n) => isVisible(n.type, visibility.data));
    },
  });
}
