import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { training } from "./controller";

/** Estado del entrenamiento; la primera vez reanuda uno en curso o pendiente de envío. */
export function useTraining() {
  const { user } = useAuth();
  const state = useSyncExternalStore(training.subscribe, training.getSnapshot);
  useEffect(() => {
    if (user?.id) void training.restore(user.id);
  }, [user?.id]);
  return state;
}

export { training };
