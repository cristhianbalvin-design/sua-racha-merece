import type { Campaign } from '@/data/mockData';

const TERMINAL_CAMPAIGN_STATUSES = new Set<Campaign['status']>([
  'Qualificado',
  'Concluído',
  'Eliminado',
]);

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: {
    writeText: (text: string) => Promise<void>;
  };
};

const normalizeDateKey = (value: string): string | null => {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const brazilianDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (brazilianDate) return `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`;

  return null;
};

export const getTodayInSaoPaulo = (now = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
};

export const isCampaignUnavailable = (
  campaign: Campaign,
  today = getTodayInSaoPaulo(),
): boolean => {
  const endDate = normalizeDateKey(campaign.endDate);

  return Boolean(campaign.isHidden)
    || TERMINAL_CAMPAIGN_STATUSES.has(campaign.status)
    || (endDate !== null && endDate < today);
};

const getShareText = (campaign: Campaign): string => {
  const description = campaign.description?.trim();
  if (description && description !== campaign.name) {
    return description.length > 140 ? `${description.slice(0, 137)}...` : description;
  }

  return campaign.prize
    ? `Participe deste desafio 3BUK e concorra a ${campaign.prize}.`
    : 'Participe deste desafio na 3BUK.';
};

export const getCampaignShareData = (campaign: Campaign, origin: string): ShareData => ({
  title: `3BUK — ${campaign.name}`,
  text: getShareText(campaign),
  url: new URL(`/campanha/${campaign.id}`, origin).toString(),
});

export const shareCampaign = async (
  data: ShareData,
  navigatorApi: ShareNavigator = navigator,
): Promise<'shared' | 'copied'> => {
  if (navigatorApi.share) {
    await navigatorApi.share(data);
    return 'shared';
  }

  if (!navigatorApi.clipboard || !data.url) {
    throw new Error('Clipboard API indisponível.');
  }

  await navigatorApi.clipboard.writeText(data.url);
  return 'copied';
};
