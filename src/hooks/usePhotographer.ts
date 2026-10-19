import { createContext, useContext } from 'react';
import type { PhotographerProfile } from '@/lib/photographerApi';

export interface PhotographerSnapshot {
  authUserId: string | null;
  email: string | null;
  isPhotographer: boolean;
  profile: PhotographerProfile | null;
}

export interface PhotographerContextValue extends PhotographerSnapshot {
  loading: boolean;
  error: string | null;
  /** Recarrega sessão + is_photographer() + perfil. */
  refresh: () => Promise<PhotographerSnapshot>;
  markTermsAccepted: (acceptedAt: string) => void;
  signOut: () => Promise<void>;
}

export const PhotographerContext = createContext<PhotographerContextValue | undefined>(undefined);

/**
 * Estado do fotógrafo logado. Só existe dentro das rotas /fotografo
 * (não faz chamadas extras no fluxo do atleta).
 */
export const usePhotographer = (): PhotographerContextValue => {
  const ctx = useContext(PhotographerContext);
  if (!ctx) throw new Error('usePhotographer deve ser usado dentro de PhotographerProvider');
  return ctx;
};
