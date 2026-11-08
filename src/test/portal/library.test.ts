import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { apiGetMyDownloads, apiRegisterDownload, downloadBlockedMessage, mapLibraryRow, type LibraryRow } from '@/lib/libraryApi';

const row = (over: Partial<LibraryRow> = {}): LibraryRow => ({
  event_photo_id: 'p1',
  image_url: 'http://x/p1.jpg',
  event_date: '2026-07-31',
  city: 'São Paulo',
  sport_name: 'Corrida',
  region_name: 'SP',
  first_downloaded_at: '2026-08-01T10:00:00Z',
  last_downloaded_at: '2026-08-02T10:00:00Z',
  download_count: 2,
  total_count: 5,
  ...over,
});

describe('libraryApi', () => {
  beforeEach(() => rpc.mockReset());

  it('mapLibraryRow convierte columnas a camelCase y normaliza nulos', () => {
    const item = mapLibraryRow(row({ event_date: null, city: null, sport_name: null, region_name: null }));
    expect(item).toMatchObject({
      eventPhotoId: 'p1',
      imageUrl: 'http://x/p1.jpg',
      eventDate: null,
      city: null,
      sportName: null,
      regionName: null,
      downloadCount: 2,
    });
  });

  it('apiGetMyDownloads pasa limit/offset al RPC y toma el total de la primera fila', async () => {
    rpc.mockResolvedValue({ data: [row({ total_count: '7' }), row({ event_photo_id: 'p2' })], error: null });
    const page = await apiGetMyDownloads(24, 12);
    expect(rpc).toHaveBeenCalledWith('get_my_downloads', { p_limit: 12, p_offset: 24 });
    expect(page.items.map((i) => i.eventPhotoId)).toEqual(['p1', 'p2']);
    expect(page.total).toBe(7);
  });

  it('apiGetMyDownloads devuelve página vacía si no hay filas', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await apiGetMyDownloads()).toEqual({ items: [], total: 0 });
  });

  it('apiGetMyDownloads propaga el error del RPC', async () => {
    const err = new Error('boom');
    rpc.mockResolvedValue({ data: null, error: err });
    await expect(apiGetMyDownloads()).rejects.toBe(err);
  });

  it('apiRegisterDownload interpreta allowed y reason (paso 27: confirmación de compra)', async () => {
    rpc.mockResolvedValueOnce({ data: { allowed: true }, error: null });
    expect(await apiRegisterDownload('p1')).toMatchObject({ allowed: true, reason: undefined });
    expect(rpc).toHaveBeenCalledWith('check_and_register_download', { p_event_photo_id: 'p1', p_confirm_purchase: false });

    rpc.mockResolvedValueOnce({ data: { allowed: true, charged: 'wallet', price_cents: 1000 }, error: null });
    expect(await apiRegisterDownload('p1', true)).toMatchObject({ allowed: true, charged: 'wallet', priceCents: 1000 });
    expect(rpc).toHaveBeenLastCalledWith('check_and_register_download', { p_event_photo_id: 'p1', p_confirm_purchase: true });

    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await apiRegisterDownload('p1')).allowed).toBe(false);
  });

  it('apiRegisterDownload mapea el estado de fotos gratis y saldo', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        allowed: false,
        reason: 'purchase_required',
        price_cents: 1000,
        status: { plan: 'Freemium', free_total: 1, free_used: 1, free_remaining: 0, free_eligible: true, found_total: 320, found_min: 300, next_free_at: '2026-12-01T00:00:00Z', price_cents: 1000, balance_cents: 2500 },
      },
      error: null,
    });
    const r = await apiRegisterDownload('p1');
    expect(r.status).toMatchObject({ plan: 'Freemium', freeRemaining: 0, freeTotal: 1, priceCents: 1000, balanceCents: 2500 });
    expect(r.status?.nextFreeAt).toBe('2026-12-01T00:00:00Z');
  });

  it('downloadBlockedMessage: saldo insuficiente en reales; compra pendiente y participación devuelven null', () => {
    expect(downloadBlockedMessage({ allowed: false, reason: 'participation_required' })).toBeNull();
    expect(downloadBlockedMessage({ allowed: false, reason: 'purchase_required' })).toBeNull();
    expect(downloadBlockedMessage({ allowed: false })).toBeNull();
    const m = downloadBlockedMessage({ allowed: false, reason: 'insufficient_balance', priceCents: 1000, status: { balanceCents: 500 } as never });
    expect(m).toContain('R$');
    expect(m).toContain('10,00');
    expect(m).toContain('5,00');
    expect(downloadBlockedMessage({ allowed: false, reason: 'photo_not_available' })).toContain('não está mais disponível');
  });
});
