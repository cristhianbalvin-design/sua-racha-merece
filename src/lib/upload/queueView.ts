import type { PoolJobStatus } from './uploadPool';

/** Estado de uma linha da fila de envio (arquivo inválido, pulado, pronto ou job do pool). */
export type RowView =
  | { kind: 'unsupported' }
  | { kind: 'too_large' }
  | { kind: 'skipped' }
  | { kind: 'ready' }
  | { kind: 'job'; status: PoolJobStatus; retries: number; error?: string; retryable: boolean };

export interface QueueRowData {
  id: string;
  name: string;
  size: number;
  exifDate: string | null | undefined;
  view: RowView;
}

export type QueueFilter = 'all' | 'queue' | 'sent' | 'error';

export const rowBucket = (v: RowView): Exclude<QueueFilter, 'all'> | 'other' => {
  if (v.kind === 'unsupported' || v.kind === 'too_large') return 'error';
  if (v.kind === 'skipped') return 'other';
  if (v.kind === 'ready') return 'queue';
  if (v.status === 'success') return 'sent';
  if (v.status === 'error') return 'error';
  if (v.status === 'cancelled') return 'other';
  return 'queue';
};
