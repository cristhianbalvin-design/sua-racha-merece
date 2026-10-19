/** Estados de event_photos e seus textos/cores na interface. */

export type PhotoStatus = 'pending' | 'approved' | 'published' | 'rejected';

export const PHOTO_STATUSES: PhotoStatus[] = ['pending', 'approved', 'published', 'rejected'];

export const isPhotoStatus = (value: unknown): value is PhotoStatus =>
  typeof value === 'string' && (PHOTO_STATUSES as string[]).includes(value);

/** Rótulo de uma foto (badge). */
export const STATUS_LABEL: Record<PhotoStatus, string> = {
  pending: 'Em análise',
  approved: 'Aprovada',
  published: 'Publicada',
  rejected: 'Recusada',
};

/** Rótulo de contadores e filtros. */
export const STATUS_LABEL_PLURAL: Record<PhotoStatus, string> = {
  pending: 'Em análise',
  approved: 'Aprovadas',
  published: 'Publicadas',
  rejected: 'Recusadas',
};

export const STATUS_NOTE: Record<PhotoStatus, string> = {
  pending: 'Aguardando a equipe 3BUK',
  approved: 'Aprovadas, ainda não publicadas',
  published: 'Visíveis na busca facial',
  rejected: 'Veja o motivo em Minhas fotos',
};

export const STATUS_BADGE_CLASS: Record<PhotoStatus, string> = {
  pending: 'bg-accent/15 text-accent border-accent/40',
  approved: 'bg-secondary/15 text-secondary border-secondary/40',
  published: 'bg-primary/15 text-primary border-primary/40',
  rejected: 'bg-destructive/15 text-destructive border-destructive/40',
};

export const STATUS_TEXT_CLASS: Record<PhotoStatus, string> = {
  pending: 'text-accent',
  approved: 'text-secondary',
  published: 'text-primary',
  rejected: 'text-destructive',
};

export type StatusCounts = Record<PhotoStatus, number> & { all: number };

/**
 * Converte as linhas de get_my_photographer_stats() ({status, total}) em contadores.
 * Estados ausentes valem 0; estados desconhecidos são ignorados.
 */
export const normalizeStats = (rows: Array<{ status: unknown; total: unknown }> | null | undefined): StatusCounts => {
  const counts: StatusCounts = { pending: 0, approved: 0, published: 0, rejected: 0, all: 0 };
  for (const row of rows ?? []) {
    if (!isPhotoStatus(row.status)) continue;
    const n = Number(row.total);
    if (!Number.isFinite(n) || n < 0) continue;
    counts[row.status] += n;
    counts.all += n;
  }
  return counts;
};

/** Formata uma data YYYY-MM-DD como DD/MM/AAAA sem passar por fuso horário. */
export const formatIsoDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Data de hoje (fuso local) em YYYY-MM-DD. */
export const todayIso = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
