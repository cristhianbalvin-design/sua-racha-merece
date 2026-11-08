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

/** Estado de fotos del usuario (paso 27): fotos gratis del año y saldo en reales. */
export interface DownloadStatus {
  plan: 'Premium' | 'Freemium';
  premiumUntil: string | null;
  freeTotal: number;
  freeUsed: number;
  freeRemaining: number;
  /** Freemium: la foto gratis exige foundMin Bukys recogidos corriendo. */
  freeEligible: boolean;
  foundTotal: number;
  foundMin: number;
  yearStart: string | null;
  nextFreeAt: string | null;
  priceCents: number;
  balanceCents: number;
}

export interface DownloadPermission {
  allowed: boolean;
  reason?: string;
  /** 'none' = re-descarga o admin; 'free' = foto gratis del año; 'wallet' = R$ del saldo. */
  charged?: 'none' | 'free' | 'wallet';
  priceCents?: number;
  status?: DownloadStatus;
}

import { brl } from '@/lib/walletApi';
export { brl };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapDownloadStatus = (s: any): DownloadStatus | undefined =>
  s && typeof s === 'object'
    ? {
        plan: s.plan === 'Premium' ? 'Premium' : 'Freemium',
        premiumUntil: typeof s.premium_until === 'string' ? s.premium_until : null,
        freeTotal: Number(s.free_total) || 0,
        freeUsed: Number(s.free_used) || 0,
        freeRemaining: Number(s.free_remaining) || 0,
        freeEligible: s.free_eligible === true,
        foundTotal: Number(s.found_total) || 0,
        foundMin: Number(s.found_min) || 0,
        yearStart: typeof s.year_start === 'string' ? s.year_start : null,
        nextFreeAt: typeof s.next_free_at === 'string' ? s.next_free_at : null,
        priceCents: Number(s.price_cents) || 0,
        balanceCents: Number(s.balance_cents) || 0,
      }
    : undefined;

export const apiGetDownloadStatus = async (): Promise<DownloadStatus | undefined> => {
  const { data, error } = await supabase.rpc('get_my_download_status');
  if (error) throw error;
  return mapDownloadStatus(data);
};

/**
 * Valida el acceso y registra la descarga. Sin fotos gratis devuelve reason 'purchase_required':
 * hay que volver a llamar con confirmPurchase = true para pagar R$10 del saldo (re-descarga es gratis).
 */
export const apiRegisterDownload = async (eventPhotoId: string, confirmPurchase = false): Promise<DownloadPermission> => {
  const { data, error } = await supabase.rpc('check_and_register_download', {
    p_event_photo_id: eventPhotoId,
    p_confirm_purchase: confirmPurchase,
  });
  if (error) throw error;
  const charged = data?.charged;
  return {
    allowed: data?.allowed === true,
    reason: typeof data?.reason === 'string' ? data.reason : undefined,
    charged: charged === 'none' || charged === 'free' || charged === 'wallet' ? charged : undefined,
    priceCents: Number(data?.price_cents) || 0,
    status: mapDownloadStatus(data?.status),
  };
};

/** Texto de confirmación de compra (sin fotos gratis en el año). */
export const purchaseConfirmText = (p: DownloadPermission): string => {
  const price = brl(p.priceCents || p.status?.priceCents || 1000);
  const bal = brl(p.status?.balanceCents ?? 0);
  return `Você não tem fotos grátis disponíveis. Comprar esta foto por ${price} do seu saldo (saldo atual: ${bal})?`;
};

/** Mensagem para o usuário quando a descarga é negada por saldo/foto. null = não é bloqueio de cobrança. */
export const downloadBlockedMessage = (p: DownloadPermission): string | null => {
  switch (p.reason) {
    case 'insufficient_balance': {
      const price = brl(p.priceCents || p.status?.priceCents || 1000);
      const bal = brl(p.status?.balanceCents ?? 0);
      return `Saldo insuficiente: esta foto custa ${price} e seu saldo é ${bal}. Recarregue em Meu saldo.`;
    }
    case 'purchase_required':
      return null;
    case 'photo_not_available':
      return 'Esta foto não está mais disponível para download.';
    case 'not_authenticated':
      return 'Faça login para baixar a foto.';
    default:
      return null;
  }
};

/** Flujo completo de la web: pide confirmar la compra con window.confirm cuando hace falta. */
export const registerDownloadConfirming = async (eventPhotoId: string): Promise<DownloadPermission> => {
  const first = await apiRegisterDownload(eventPhotoId);
  if (first.allowed || first.reason !== 'purchase_required') return first;
  if (!window.confirm(purchaseConfirmText(first))) return { allowed: false, reason: 'purchase_cancelled', status: first.status };
  return apiRegisterDownload(eventPhotoId, true);
};
