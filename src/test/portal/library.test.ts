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

  it('apiRegisterDownload interpreta allowed y reason', async () => {
    rpc.mockResolvedValueOnce({ data: { allowed: true }, error: null });
    expect(await apiRegisterDownload('p1')).toMatchObject({ allowed: true, reason: undefined });
    expect(rpc).toHaveBeenCalledWith('check_and_register_download', { p_event_photo_id: 'p1' });

    rpc.mockResolvedValueOnce({ data: { allowed: false, reason: 'photo_not_available' }, error: null });
    expect(await apiRegisterDownload('p1')).toMatchObject({ allowed: false, reason: 'photo_not_available' });

    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await apiRegisterDownload('p1')).allowed).toBe(false);
  });

  it('apiRegisterDownload mapea charged y status', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        allowed: false,
        reason: 'free_quota_exhausted',
        status: { plan: 'Freemium', free_quota: 3, free_window_months: 3, free_used: 3, free_remaining: 0, next_free_at: '2026-12-01T00:00:00Z', balance: 0, cost: 10 },
      },
      error: null,
    });
    const r = await apiRegisterDownload('p1');
    expect(r.status).toMatchObject({ plan: 'Freemium', freeRemaining: 0, freeQuota: 3, cost: 10 });
    expect(r.status?.nextFreeAt).toBe('2026-12-01T00:00:00Z');

    rpc.mockResolvedValueOnce({ data: { allowed: true, charged: 'credits' }, error: null });
    expect((await apiRegisterDownload('p1')).charged).toBe('credits');
  });

  it('downloadBlockedMessage da mensagem por motivo y null si es participación', () => {
    expect(downloadBlockedMessage({ allowed: false, reason: 'participation_required' })).toBeNull();
    expect(downloadBlockedMessage({ allowed: false })).toBeNull();
    expect(downloadBlockedMessage({ allowed: false, reason: 'free_quota_exhausted' })).toContain('fotos grátis');
    expect(
      downloadBlockedMessage({
        allowed: false,
        reason: 'insufficient_credits',
        status: { plan: 'Premium', freeQuota: 3, freeWindowMonths: 3, freeUsed: 0, freeRemaining: 3, nextFreeAt: null, balance: 5, cost: 10 },
      }),
    ).toContain('saldo é 5');
    expect(downloadBlockedMessage({ allowed: false, reason: 'photo_not_available' })).toContain('não está mais disponível');
  });
});
