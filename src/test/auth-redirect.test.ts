import { describe, expect, it } from 'vitest';
import {
  AUTH_REDIRECT_STORAGE_KEY,
  buildAuthRedirect,
  consumeAuthRedirect,
  getAuthRedirectFromState,
  persistAuthRedirect,
} from '@/lib/authRedirect';
import { isCampaignUnavailable } from '@/lib/campaignSharing';
import type { Campaign } from '@/data/mockData';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

describe('auth deep-link redirects', () => {
  it('captures pathname and search and reads it from router state', () => {
    const redirectTo = buildAuthRedirect('/campanha/campaign-123', '?source=share');

    expect(redirectTo).toBe('/campanha/campaign-123?source=share');
    expect(getAuthRedirectFromState({ redirectTo })).toBe(redirectTo);
  });

  it('rejects external redirects', () => {
    expect(getAuthRedirectFromState({ redirectTo: 'https://example.com' })).toBeNull();
    expect(getAuthRedirectFromState({ redirectTo: '//example.com' })).toBeNull();
  });

  it('persists an OAuth redirect and consumes it only once', () => {
    const storage = createStorage();

    persistAuthRedirect('/campanha/campaign-123', storage);
    expect(storage.getItem(AUTH_REDIRECT_STORAGE_KEY)).toBe('/campanha/campaign-123');
    expect(consumeAuthRedirect(storage)).toBe('/campanha/campaign-123');
    expect(consumeAuthRedirect(storage)).toBeNull();
  });

  it('still applies terminal campaign validation after the redirect is consumed', () => {
    const campaign: Campaign = {
      id: 'campaign-123',
      name: 'Campanha encerrada',
      sport: 'Corrida',
      sportIcon: '',
      city: 'Niterói',
      region: 'Rio de Janeiro',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      description: 'Campanha encerrada',
      winnersCount: 1,
      prize: 'R$ 100',
      status: 'Qualificado',
      createdAt: '2026-07-01T00:00:00.000Z',
    };
    const storage = createStorage();

    persistAuthRedirect(`/campanha/${campaign.id}`, storage);
    expect(consumeAuthRedirect(storage)).toBe(`/campanha/${campaign.id}`);
    expect(isCampaignUnavailable(campaign, '2026-08-02')).toBe(true);
  });
});
