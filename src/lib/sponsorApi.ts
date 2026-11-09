import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type Sponsor = { id: string; name: string };
export function useSponsors() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-sponsors", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("buky_my_sponsors");
      if (error) throw error;
      return data as Sponsor[];
    },
  });
}
