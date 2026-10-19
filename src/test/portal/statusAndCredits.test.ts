import { describe, expect, it } from 'vitest';
import { STATUS_LABEL, STATUS_LABEL_PLURAL, formatIsoDate, isPhotoStatus, normalizeStats } from '@/lib/photoStatus';
import {
  adminLedgerReasonLabel,
  creditErrorMessage,
  formatDelta,
  ledgerReasonLabel,
  parseAdjustAmount,
  parseCostInput,
  parseCreditCost,
  photosEquivalent,
} from '@/lib/credits';
import { interpretInviteError } from '@/lib/photographerInvite';
import { SentRegistry, sentRegistryKey, type StorageLike } from '@/lib/upload/sentRegistry';

describe('estados das fotos', () => {
  it('normaliza get_my_photographer_stats com ausentes = 0', () => {
    const c = normalizeStats([
      { status: 'pending', total: 18 },
      { status: 'published', total: '540' },
      { status: 'outro', total: 9 },
    ]);
    expect(c).toEqual({ pending: 18, approved: 0, published: 540, rejected: 0, all: 558 });
    expect(normalizeStats(null).all).toBe(0);
  });

  it('rótulos em português', () => {
    expect(STATUS_LABEL.pending).toBe('Em análise');
    expect(STATUS_LABEL_PLURAL.approved).toBe('Aprovadas');
    expect(STATUS_LABEL_PLURAL.published).toBe('Publicadas');
    expect(STATUS_LABEL.rejected).toBe('Recusada');
    expect(isPhotoStatus('pending')).toBe(true);
    expect(isPhotoStatus('deleted')).toBe(false);
  });

  it('formata data sem deslocar fuso', () => {
    expect(formatIsoDate('2026-09-14')).toBe('14/09/2026');
  });
});

describe('créditos', () => {
  it('mapeia motivos do livro para o atleta', () => {
    expect(ledgerReasonLabel('admin_grant')).toBe('Crédito concedido pela equipe 3BUK');
    expect(ledgerReasonLabel('admin_adjustment')).toBe('Ajuste da equipe 3BUK');
    expect(ledgerReasonLabel('photo_download')).toBe('Download de foto');
    expect(ledgerReasonLabel('algo_novo')).toBe('Movimentação de créditos');
    expect(ledgerReasonLabel(null)).toBe('Movimentação de créditos');
  });

  it('motivo do admin inclui a nota', () => {
    expect(adminLedgerReasonLabel('admin_grant', 'Bônus de lançamento')).toBe('Crédito concedido · Bônus de lançamento');
    expect(adminLedgerReasonLabel('admin_adjustment', '')).toBe('Ajuste');
  });

  it('formata movimentos e equivalência em fotos', () => {
    expect(formatDelta(30)).toBe('+30');
    expect(formatDelta(-10)).toBe('−10');
    expect(photosEquivalent(40, 10)).toBe(4);
    expect(photosEquivalent(45, 10)).toBe(4);
    expect(photosEquivalent(40, 0)).toBe(0);
  });

  it('valida custo e ajuste', () => {
    expect(parseCreditCost(10)).toBe(10);
    expect(parseCreditCost('12')).toBe(12);
    expect(parseCreditCost(0)).toBeNull();
    expect(parseCreditCost(2.5)).toBeNull();
    expect(parseAdjustAmount('-10')).toEqual({ ok: true, value: -10 });
    expect(parseAdjustAmount('+30')).toEqual({ ok: true, value: 30 });
    expect(parseAdjustAmount('0').ok).toBe(false);
    expect(parseAdjustAmount('1.5').ok).toBe(false);
    expect(parseCostInput('10')).toEqual({ ok: true, value: 10 });
    expect(parseCostInput('-1').ok).toBe(false);
    expect(parseCostInput('0').ok).toBe(false);
  });

  it('traduz erros das RPCs', () => {
    expect(creditErrorMessage('insufficient_credits')).toMatch(/negativo/);
    expect(creditErrorMessage('note_required')).toMatch(/nota/);
  });
});

describe('convite de fotógrafo', () => {
  it('interpreta respostas da função', () => {
    expect(interpretInviteError(409, { error: 'Photographer already has an account' }).kind).toBe('already_has_account');
    expect(interpretInviteError(409, { error: 'Email already registered' }).kind).toBe('email_registered');
    expect(interpretInviteError(400, { error: 'Invalid email' }).kind).toBe('invalid_email');
    expect(interpretInviteError(404, { error: 'Photographer not found' }).kind).toBe('not_found');
    expect(interpretInviteError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }).kind).toBe('not_deployed');
    expect(interpretInviteError(null, null, 'FunctionsFetchError').kind).toBe('not_deployed');
  });
});

describe('registro de fotos já enviadas', () => {
  const memory = (): StorageLike & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  };
  const ev = { region_id: 'r', sport_id: 's', city: ' São Paulo ', event_date: '2026-09-14' };

  it('persiste por fotógrafo + evento', () => {
    const storage = memory();
    const key = sentRegistryKey('ph1', ev);
    const reg = new SentRegistry(storage, key);
    expect(reg.add('a.jpg|10')).toBe(true);
    expect(new SentRegistry(storage, key).has('a.jpg|10')).toBe(true);
    expect(new SentRegistry(storage, sentRegistryKey('ph2', ev)).has('a.jpg|10')).toBe(false);
    expect(sentRegistryKey('ph1', { ...ev, city: 'são paulo' })).toBe(key);
  });

  it('não quebra quando o armazenamento falha', () => {
    const broken: StorageLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
    };
    const reg = new SentRegistry(broken, 'k');
    expect(reg.has('x')).toBe(false);
    expect(reg.add('x')).toBe(false);
    expect(reg.has('x')).toBe(true);
    expect(new SentRegistry(null, 'k').add('y')).toBe(false);
  });
});

import { rowBucket } from '@/lib/upload/queueView';

describe('filtros da fila de envio', () => {
  it('classifica linhas em Na fila / Enviadas / Com erro', () => {
    expect(rowBucket({ kind: 'ready' })).toBe('queue');
    expect(rowBucket({ kind: 'unsupported' })).toBe('error');
    expect(rowBucket({ kind: 'too_large' })).toBe('error');
    expect(rowBucket({ kind: 'skipped' })).toBe('other');
    expect(rowBucket({ kind: 'job', status: 'retrying', retries: 1, retryable: true })).toBe('queue');
    expect(rowBucket({ kind: 'job', status: 'success', retries: 0, retryable: false })).toBe('sent');
    expect(rowBucket({ kind: 'job', status: 'error', retries: 3, retryable: true })).toBe('error');
  });
});
