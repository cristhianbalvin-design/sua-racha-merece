import { next } from '@vercel/functions';

const CAMPAIGN_ROUTE = /^\/campanha\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;
const CRAWLER_USER_AGENT = /(?:WhatsApp|facebookexternalhit|Facebot|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot|SkypeUriPreview|Pinterestbot|redditbot|Googlebot|bingbot)/i;
const TERMINAL_STATUSES = new Set(['Qualificado', 'Concluído', 'Eliminado']);

export const GENERIC_PREVIEW = {
  title: '3BUK',
  description: 'Seu esforço merece patrocínio. Participe de campanhas e conquiste oportunidades reais no esporte.',
  image: 'https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/08178081-f6f8-4991-8319-9f137c9ea7a8/id-preview-306b1e0e--851ae782-a7db-4ec7-a265-5faaa3548977.lovable.app-1773278142764.png',
} as const;

type CampaignPreviewRecord = {
  id: string;
  name: string;
  description: string;
  prize: string;
  image_url: string | null;
  image_url_mobile: string | null;
  status: string | null;
  is_hidden: boolean | null;
  end_date: string;
};

type PreviewMetadata = {
  title: string;
  description: string;
  image: string;
  url: string;
};

export const config = {
  matcher: '/campanha/:path*',
  runtime: 'edge',
};

const getTodayInSaoPaulo = (now: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const cleanText = (value: string | null | undefined): string => value?.replace(/\s+/g, ' ').trim() ?? '';

const truncate = (value: string, maxLength = 180): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
};

const safeHttpUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const isCampaignPreviewCrawler = (userAgent: string | null): boolean => CRAWLER_USER_AGENT.test(userAgent ?? '');

export const isPreviewCampaignUnavailable = (
  campaign: CampaignPreviewRecord,
  now = new Date(),
): boolean => Boolean(campaign.is_hidden)
  || TERMINAL_STATUSES.has(campaign.status ?? '')
  || campaign.end_date < getTodayInSaoPaulo(now);

export const buildCampaignPreviewMetadata = (
  campaign: CampaignPreviewRecord | null,
  url: string,
  now = new Date(),
): PreviewMetadata => {
  if (!campaign || isPreviewCampaignUnavailable(campaign, now)) {
    return { ...GENERIC_PREVIEW, url };
  }

  const name = cleanText(campaign.name) || 'Campanha 3BUK';
  const challenge = cleanText(campaign.description);
  const prize = cleanText(campaign.prize);
  const description = truncate([
    challenge || 'Participe desta campanha e mostre sua atitude.',
    prize ? `Prêmio: ${prize}.` : '',
  ].filter(Boolean).join(' '));

  return {
    title: `3BUK — ${name}`,
    description,
    image: safeHttpUrl(campaign.image_url)
      ?? safeHttpUrl(campaign.image_url_mobile)
      ?? GENERIC_PREVIEW.image,
    url,
  };
};

export const renderCampaignPreviewHtml = (metadata: PreviewMetadata): string => {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const image = escapeHtml(metadata.image);
  const url = escapeHtml(metadata.url);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="3BUK">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:url" content="${url}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${description}</p>
      <a href="${url}">Abrir na 3BUK</a>
    </main>
  </body>
</html>`;
};

const fetchCampaign = async (id: string): Promise<CampaignPreviewRecord | null> => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const endpoint = new URL('/rest/v1/campaigns', supabaseUrl);
    endpoint.searchParams.set('select', 'id,name,description,prize,image_url,image_url_mobile,status,is_hidden,end_date');
    endpoint.searchParams.set('id', `eq.${id}`);
    endpoint.searchParams.set('limit', '1');

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;

    const rows = await response.json() as CampaignPreviewRecord[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
};

export default async function middleware(request: Request): Promise<Response> {
  if (!isCampaignPreviewCrawler(request.headers.get('user-agent'))) {
    return next();
  }

  const requestUrl = new URL(request.url);
  const match = requestUrl.pathname.match(CAMPAIGN_ROUTE);
  const canonicalUrl = `${requestUrl.origin}${requestUrl.pathname}`;
  const campaign = match ? await fetchCampaign(match[1]) : null;
  const metadata = buildCampaignPreviewMetadata(campaign, canonicalUrl);

  return new Response(renderCampaignPreviewHtml(metadata), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'index, follow',
    },
  });
}
