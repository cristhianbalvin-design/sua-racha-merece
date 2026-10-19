/** Moderação de fotos de eventos (admin). Nunca seleciona `embedding`. */
import { supabase } from '@/lib/supabase';
import type { PhotoStatus } from '@/lib/photoStatus';

export const MODERATION_PHOTO_COLUMNS =
  'id, image_url, created_at, city, event_date, status, photographer_id, sport_id, region_id, rejection_reason, reviewed_at, uploaded_by_photographer';

export interface ModerationPhoto {
  id: string;
  image_url: string;
  created_at: string;
  city: string | null;
  event_date: string | null;
  status: PhotoStatus;
  photographer_id: string | null;
  sport_id: string | null;
  region_id: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  uploaded_by_photographer: boolean | null;
}

export interface ModerationFilters {
  status: PhotoStatus;
  photographerId?: string;
  eventDate?: string;
}

export type ModerationAction = 'approve' | 'publish' | 'approve_publish' | 'reject';

export const apiListModerationPhotos = async (
  filters: ModerationFilters,
  page: number,
  pageSize: number,
): Promise<{ photos: ModerationPhoto[]; total: number }> => {
  const from = page * pageSize;
  let query = supabase
    .from('event_photos')
    .select(MODERATION_PHOTO_COLUMNS, { count: 'exact' })
    .eq('status', filters.status)
    .order('created_at', { ascending: filters.status === 'pending' })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1);
  if (filters.photographerId) query = query.eq('photographer_id', filters.photographerId);
  if (filters.eventDate) query = query.eq('event_date', filters.eventDate);
  const { data, error, count } = await query;
  if (error) throw error;
  return { photos: (data ?? []) as ModerationPhoto[], total: count ?? 0 };
};

export const apiCountPendingPhotos = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('event_photos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
};

/** Devolve quantas fotos mudaram de estado (pode ser menor que o enviado). */
export const apiModeratePhotos = async (ids: string[], action: ModerationAction, reason?: string): Promise<number> => {
  const { data, error } = await supabase.rpc('moderate_event_photos', {
    p_photo_ids: ids,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
};

export const moderationErrorMessage = (message: string | undefined): string => {
  const m = message || '';
  if (m.includes('admin_only')) return 'Apenas administradores podem moderar fotos.';
  if (m.includes('reason_required_for_reject')) return 'Informe o motivo da recusa.';
  if (m.includes('invalid_action')) return 'Ação inválida.';
  return m || 'Não foi possível moderar as fotos.';
};
