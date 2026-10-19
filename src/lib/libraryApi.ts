/** Biblioteca de descargas do atleta (RPC get_my_downloads / check_and_register_download). */
import { supabase } from '@/lib/supabase';

export interface LibraryItem {
  eventPhotoId: string;
  imageUrl: string;
  eventDate: string | null;
  city: string | null;
  sportName: string | null;
  regionName: string | null;
  firstDownloadedAt: string;
  lastDownloadedAt: string;
  downloadCount: number;
}

export interface LibraryPage {
  items: LibraryItem[];
  total: number;
}

export interface LibraryRow {
  event_photo_id: string;
  image_url: string;
  event_date: string | null;
  city: string | null;
  sport_name: string | null;
  region_name: string | null;
  first_downloaded_at: string;
  last_downloaded_at: string;
  download_count: number;
  total_count: number | string;
}

export const mapLibraryRow = (r: LibraryRow): LibraryItem => ({
  eventPhotoId: r.event_photo_id,
  imageUrl: r.image_url,
  eventDate: r.event_date ?? null,
  city: r.city ?? null,
  sportName: r.sport_name ?? null,
  regionName: r.region_name ?? null,
  firstDownloadedAt: r.first_downloaded_at,
  lastDownloadedAt: r.last_downloaded_at,
  downloadCount: Number(r.download_count) || 1,
});

export const apiGetMyDownloads = async (offset = 0, limit = 24): Promise<LibraryPage> => {
  const { data, error } = await supabase.rpc('get_my_downloads', { p_limit: limit, p_offset: offset });
  if (error) throw error;
  const rows = (data ?? []) as LibraryRow[];
  return {
    items: rows.map(mapLibraryRow),
    total: rows.length ? Number(rows[0].total_count) || rows.length : 0,
  };
};

export interface DownloadPermission {
  allowed: boolean;
  reason?: string;
}

/** Valida o acesso e registra a descarga (idempotente por usuário+foto). */
export const apiRegisterDownload = async (eventPhotoId: string): Promise<DownloadPermission> => {
  const { data, error } = await supabase.rpc('check_and_register_download', { p_event_photo_id: eventPhotoId });
  if (error) throw error;
  return { allowed: data?.allowed === true, reason: typeof data?.reason === 'string' ? data.reason : undefined };
};
