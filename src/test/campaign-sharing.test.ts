import { describe, expect, it, vi } from 'vitest';
import type { Campaign } from '@/data/mockData';
import {
  getCampaignShareData,
  isCampaignUnavailable,
  shareCampaign,
} from '@/lib/campaignSharing';

const campaign: Campaign = {
  id: 'campaign-123',
  name: 'Corrida de Rua',
  sport: 'Corrida de Rua',
  sportIcon: '',
  city: 'Niterói',
  region: 'Rio de Janeiro',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  description: 'Corra com atitude e mostre seu melhor desempenho.',
  winnersCount: 1,
  prize: 'R$ 100',
  status: 'Aberto',
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('campaign sharing and availability', () => {
  it.each(['Qualificado', 'Concluído', 'Eliminado'] as const)(
    'blocks the terminal status %s',
    (status) => {
      expect(isCampaignUnavailable({ ...campaign, status }, '2026-08-02')).toBe(true);
    },
  );

  it('blocks hidden and expired campaigns but keeps an open current campaign available', () => {
    expect(isCampaignUnavailable({ ...campaign, isHidden: true }, '2026-08-02')).toBe(true);
    expect(isCampaignUnavailable({ ...campaign, endDate: '2026-08-01' }, '2026-08-02')).toBe(true);
    expect(isCampaignUnavailable({ ...campaign, endDate: '01/08/2026' }, '2026-08-02')).toBe(true);
    expect(isCampaignUnavailable(campaign, '2026-08-02')).toBe(false);
  });

  it('uses the complete campaign URL and native share when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const data = getCampaignShareData(campaign, 'https://3buk.com');

    await expect(shareCampaign(data, { share })).resolves.toBe('shared');
    expect(data).toEqual({
      title: '3BUK — Corrida de Rua',
      text: campaign.description,
      url: 'https://3buk.com/campanha/campaign-123',
    });
    expect(share).toHaveBeenCalledWith(data);
  });

  it('copies the complete URL when native share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const data = getCampaignShareData(campaign, 'https://3buk.com');

    await expect(shareCampaign(data, { clipboard: { writeText } })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://3buk.com/campanha/campaign-123');
  });
});
