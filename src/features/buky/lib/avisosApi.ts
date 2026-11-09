import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
export function useAvisos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["buky-avisos", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,message,read,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
