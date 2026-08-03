import { describe, expect, it } from 'vitest';
import {
  GENERIC_PREVIEW,
  buildCampaignPreviewMetadata,
  isCampaignPreviewCrawler,
  isPreviewCampaignUnavailable,
  renderCampaignPreviewHtml,
} from '../../middleware';

const openCampaign = {
  id: 'ebabfa48-ceb4-4799-a00f-c72f82a7d7ee',
  name: 'Prueba 3',
  description: 'Desafio de karatê',
  prize: 'Tênis',
  image_url: 'https://example.com/campaign.jpg',
  image_url_mobile: 'https://example.com/campaign-mobile.jpg',
  status: 'Aberto',
  is_hidden: false,
  end_date: '2026-08-31',
};

describe('campaign social preview middleware helpers', () => {
  it.each([
    'WhatsApp/2.24.1',
    'facebookexternalhit/1.1',
    'Twitterbot/1.0',
    'Slackbot-LinkExpanding 1.0',
    'TelegramBot (like TwitterBot)',
    'LinkedInBot/1.0',
    'Discordbot/2.0',
    'Googlebot/2.1',
    'bingbot/2.0',
  ])('recognizes crawler user-agent %s', (userAgent) => {
    expect(isCampaignPreviewCrawler(userAgent)).toBe(true);
  });

  it('does not intercept a normal browser', () => {
    expect(isCampaignPreviewCrawler('Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36')).toBe(false);
  });

  it('builds campaign-specific metadata for an available campaign', () => {
    const metadata = buildCampaignPreviewMetadata(
      openCampaign,
      'https://3buk.com/campanha/ebabfa48-ceb4-4799-a00f-c72f82a7d7ee',
      new Date('2026-08-02T12:00:00Z'),
    );

    expect(metadata).toEqual({
      title: '3BUK — Prueba 3',
      description: 'Desafio de karatê Prêmio: Tênis.',
      image: 'https://example.com/campaign.jpg',
      url: 'https://3buk.com/campanha/ebabfa48-ceb4-4799-a00f-c72f82a7d7ee',
    });
  });

  it.each(['Qualificado', 'Concluído', 'Eliminado'])('uses generic metadata for status %s', (status) => {
    const metadata = buildCampaignPreviewMetadata(
      { ...openCampaign, name: 'Segredo terminal', status },
      'https://3buk.com/campanha/example',
      new Date('2026-08-02T12:00:00Z'),
    );

    expect(metadata).toEqual({ ...GENERIC_PREVIEW, url: 'https://3buk.com/campanha/example' });
    expect(JSON.stringify(metadata)).not.toContain('Segredo terminal');
  });

  it('treats hidden and expired campaigns as unavailable', () => {
    const now = new Date('2026-08-02T12:00:00Z');
    expect(isPreviewCampaignUnavailable({ ...openCampaign, is_hidden: true }, now)).toBe(true);
    expect(isPreviewCampaignUnavailable({ ...openCampaign, end_date: '2026-08-01' }, now)).toBe(true);
    expect(isPreviewCampaignUnavailable(openCampaign, now)).toBe(false);
  });

  it('uses generic metadata when the campaign does not exist', () => {
    expect(buildCampaignPreviewMetadata(null, 'https://3buk.com/campanha/missing')).toEqual({
      ...GENERIC_PREVIEW,
      url: 'https://3buk.com/campanha/missing',
    });
  });

  it('escapes database text before rendering HTML', () => {
    const html = renderCampaignPreviewHtml({
      title: '3BUK — <script>alert("x")</script>',
      description: 'A&B',
      image: 'https://example.com/image.jpg?x=1&y=2',
      url: 'https://3buk.com/campanha/id?x=1&y=2',
    });

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('x=1&amp;y=2');
  });
});
