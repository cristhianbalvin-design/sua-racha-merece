import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { apiGetMyPhotographerProfile, apiIsPhotographer } from '@/lib/photographerApi';
import { PhotographerContext, type PhotographerContextValue, type PhotographerSnapshot } from '@/hooks/usePhotographer';

const EMPTY: PhotographerSnapshot = { authUserId: null, email: null, isPhotographer: false, profile: null };

const PhotographerProvider = ({ children }: { children: ReactNode }) => {
  const [snapshot, setSnapshot] = useState<PhotographerSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const lastUserId = useRef<string | null | undefined>(undefined);

  const load = useCallback(async (): Promise<PhotographerSnapshot> => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      let next: PhotographerSnapshot = EMPTY;
      if (user) {
        const isPhotographer = await apiIsPhotographer();
        const profile = isPhotographer ? await apiGetMyPhotographerProfile(user.id) : null;
        next = { authUserId: user.id, email: user.email ?? null, isPhotographer: isPhotographer && !!profile, profile };
      }
      lastUserId.current = next.authUserId;
      if (id === requestId.current) {
        setSnapshot(next);
        setLoading(false);
      }
      return next;
    } catch (err) {
      console.error('Erro ao carregar o perfil do fotógrafo:', err);
      if (id === requestId.current) {
        setError('Não foi possível verificar seu acesso. Tente novamente.');
        setLoading(false);
      }
      return EMPTY;
    }
  }, []);

  useEffect(() => {
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id ?? null;
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || userId === lastUserId.current) return;
      // Fora do callback: chamadas ao Supabase dentro dele podem travar o cliente.
      setTimeout(() => {
        load();
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const markTermsAccepted = useCallback((acceptedAt: string) => {
    setSnapshot((prev) => (prev.profile ? { ...prev, profile: { ...prev.profile, terms_accepted_at: acceptedAt } } : prev));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    lastUserId.current = null;
    setSnapshot(EMPTY);
  }, []);

  const value = useMemo<PhotographerContextValue>(
    () => ({ ...snapshot, loading, error, refresh: load, markTermsAccepted, signOut }),
    [snapshot, loading, error, load, markTermsAccepted, signOut],
  );

  return <PhotographerContext.Provider value={value}>{children}</PhotographerContext.Provider>;
};

export default PhotographerProvider;
