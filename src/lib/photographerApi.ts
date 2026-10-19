/**
 * Acesso a dados do Portal do Fotógrafo.
 * Regra: nunca selecionar a coluna `embedding` de event_photos — sempre lista explícita.
 */
import { supabase } from '@/lib/supabase';
import { normalizeStats, type PhotoStatus, type StatusCounts } from '@/lib/photoStatus';
import { createEdgeUploader, type EdgeUploader } from '@/lib/upload/edgeUpload';
import { interpretInviteError, type InviteErrorInfo } from '@/lib/photographerInvite';

export const PHOTOGRAPHER_PHOTO_COLUMNS =
  'id, image_url, created_at, city, event_date, status, sport_id, region_id, rejection_reason, reviewed_at';

export interface PhotographerProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  terms_accepted_at: string | null;
}

export interface PhotographerPhoto {
  id: string;
  image_url: string;
  created_at: string;
  city: string | null;
  event_date: string | null;
  status: PhotoStatus;
  sport_id: string | null;
  region_id: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
}

export const apiIsPhotographer = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_photographer');
  if (error) throw error;
  return data === true;
};

/** Perfil do fotógrafo logado (a RLS só devolve a própria linha). */
export const apiGetMyPhotographerProfile = async (authUserId: string): Promise<PhotographerProfile | null> => {
  const { data, error } = await supabase
    .from('photographers')
    .select('id, name, email, phone, photo_url, terms_accepted_at')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return (data as PhotographerProfile | null) ?? null;
};

export const apiAcceptPhotographerTerms = async (): Promise<string> => {
  const { data, error } = await supabase.rpc('accept_photographer_terms');
  if (error) throw error;
  return data as string;
};

export const apiGetMyPhotographerStats = async (): Promise<StatusCounts> => {
  const { data, error } = await supabase.rpc('get_my_photographer_stats');
  if (error) throw error;
  return normalizeStats(data as Array<{ status: string; total: number }>);
};

/**
 * Fotos do fotógrafo. O filtro por photographer_id é obrigatório: a RLS também
 * deixa qualquer usuário autenticado ver fotos publicadas de outros fotógrafos.
 */
export const apiGetMyPhotos = async (
  photographerId: string,
  opts: { status?: PhotoStatus | 'all'; from: number; to: number },
): Promise<{ photos: PhotographerPhoto[]; total: number }> => {
  let query = supabase
    .from('event_photos')
    .select(PHOTOGRAPHER_PHOTO_COLUMNS, { count: 'exact' })
    .eq('photographer_id', photographerId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(opts.from, opts.to);
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  const { data, error, count } = await query;
  if (error) throw error;
  return { photos: (data ?? []) as PhotographerPhoto[], total: count ?? 0 };
};

/** Cidades já usadas nas fotos do próprio fotógrafo (para o datalist). */
export const apiGetMyPhotoCities = async (photographerId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('event_photos')
    .select('city')
    .eq('photographer_id', photographerId)
    .not('city', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);
  return Array.from(new Set((data ?? []).map((r: { city: string | null }) => r.city).filter(Boolean))) as string[];
};

const getAccessToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

/** Mesmo endpoint usado em AdminEventPhotos. */
export const UPLOAD_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-event-photo`;

export const photographerUploader: EdgeUploader = createEdgeUploader({
  functionUrl: UPLOAD_FUNCTION_URL,
  getAccessToken,
});

// ---------------------------------------------------------------------------
// Admin: convite (Edge Function invite-photographer)
// ---------------------------------------------------------------------------

export interface InviteResult {
  ok: true;
  emailSent: boolean;
  warning?: string;
}

export const apiInvitePhotographer = async (
  photographerId: string,
  email?: string,
): Promise<InviteResult | ({ ok: false } & InviteErrorInfo)> => {
  const body: Record<string, string> = { photographer_id: photographerId };
  if (email) body.email = email.trim();
  try {
    const { data, error } = await supabase.functions.invoke('invite-photographer', { body });
    if (error) {
      const ctx = (error as { context?: unknown }).context;
      let status: number | null = null;
      let parsed: unknown = null;
      if (ctx instanceof Response) {
        status = ctx.status;
        try {
          parsed = await ctx.clone().json();
        } catch {
          try {
            parsed = await ctx.text();
          } catch {
            parsed = null;
          }
        }
      }
      return { ok: false, ...interpretInviteError(status, parsed, (error as { name?: string }).name) };
    }
    const d = (data ?? {}) as { email_sent?: boolean; warning?: string };
    return { ok: true, emailSent: d.email_sent !== false, warning: d.warning };
  } catch (err) {
    return { ok: false, ...interpretInviteError(null, null, (err as { name?: string })?.name) };
  }
};
