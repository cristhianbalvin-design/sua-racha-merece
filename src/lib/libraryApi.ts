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

export interface DownloadStatus {
  plan: 'Premium' | 'Freemium';
  freeQuota: number;
  freeWindowMonths: number;
  freeUsed: number;
  freeRemaining: number;
  nextFreeAt: string | null;
  balance: number;
  cost: number;
}

export interface DownloadPermission {
  allowed: boolean;
  reason?: string;
  /** 'none' = re-descarga o admin; 'free' = cupo gratis; 'credits' = descontó créditos. */
  charged?: 'none' | 'free' | 'credits';
  status?: DownloadStatus;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapStatus = (s: any): DownloadStatus | undefined =>
  s && typeof s === 'object'
    ? {
        plan: s.plan === 'Premium' ? 'Premium' : 'Freemium',
        freeQuota: Number(s.free_quota) || 0,
        freeWindowMonths: Number(s.free_window_months) || 0,
        freeUsed: Number(s.free_used) || 0,
        freeRemaining: Number(s.free_remaining) || 0,
        nextFreeAt: typeof s.next_free_at === 'string' ? s.next_free_at : null,
        balance: Number(s.balance) || 0,
        cost: Number(s.cost) || 0,
      }
    : undefined;

/** Valida o acesso, aplica cupo/créditos e registra a descarga (re-descarga é grátis). */
export const apiRegisterDownload = async (eventPhotoId: string): Promise<DownloadPermission> => {
  const { data, error } = await supabase.rpc('check_and_register_download', { p_event_photo_id: eventPhotoId });
  if (error) throw error;
  const charged = data?.charged;
  return {
    allowed: data?.allowed === true,
    reason: typeof data?.reason === 'string' ? data.reason : undefined,
    charged: charged === 'none' || charged === 'free' || charged === 'credits' ? charged : undefined,
    status: mapStatus(data?.status),
  };
};

/** Mensagem para o usuário quando a descarga é negada por cupo/saldo/foto. null = não é bloqueio de cobrança. */
export const downloadBlockedMessage = (p: DownloadPermission): string | null => {
  switch (p.reason) {
    case 'free_quota_exhausted': {
      const q = p.status?.freeQuota ?? 3;
      const m = p.status?.freeWindowMonths ?? 3;
      const when = p.status?.nextFreeAt
        ? ` Nova foto grátis liberada em ${new Date(p.status.nextFreeAt).toLocaleDateString('pt-BR')}.`
        : '';
      return `Você usou suas ${q} fotos grátis dos últimos ${m} meses.${when} Seja Premium para baixar mais.`;
    }
    case 'insufficient_credits': {
      const cost = p.status?.cost ?? 0;
      const bal = p.status?.balance ?? 0;
      return `Créditos insuficientes: esta foto custa ${cost} e seu saldo é ${bal}.`;
    }
    case 'photo_not_available':
      return 'Esta foto não está mais disponível para download.';
    case 'not_authenticated':
      return 'Faça login para baixar a foto.';
    default:
      return null;
  }
};
