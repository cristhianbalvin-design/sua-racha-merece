/** Regras e textos de créditos (sem acesso ao Supabase, para poder testar). */

/** Texto do motivo de um movimento, como o atleta vê. */
export const ledgerReasonLabel = (reason: string | null | undefined): string => {
  switch (reason) {
    case 'admin_grant':
      return 'Crédito concedido pela equipe 3BUK';
    case 'admin_adjustment':
      return 'Ajuste da equipe 3BUK';
    case 'photo_download':
    case 'download':
      return 'Download de foto';
    case 'premium_refund':
      return 'Estorno do plano Premium';
    case 'premium_purchase':
      return 'Créditos do plano Premium';
    case 'purchase':
      return 'Compra de créditos';
    case 'refund':
      return 'Estorno';
    default:
      if (reason && reason.startsWith('premium')) return 'Créditos do plano Premium';
      return 'Movimentação de créditos';
  }
};

/** Texto do motivo para o admin: inclui a nota interna quando houver. */
export const adminLedgerReasonLabel = (reason: string | null | undefined, note?: string | null): string => {
  const base =
    reason === 'admin_grant' ? 'Crédito concedido' : reason === 'admin_adjustment' ? 'Ajuste' : ledgerReasonLabel(reason);
  return note && note.trim() ? `${base} · ${note.trim()}` : base;
};

/** Quem fez o movimento, para a coluna "Por" do admin. */
export const ledgerActorLabel = (reason: string | null | undefined, createdBy: string | null | undefined): string => {
  if (reason && reason.startsWith('admin_')) return 'Admin';
  return createdBy ? 'Usuário' : 'Sistema';
};

/** "+30" / "−10" (com sinal de menos tipográfico). */
export const formatDelta = (delta: number): string => (delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`);

/** Quantas fotos o saldo paga, dado o custo por foto. */
export const photosEquivalent = (balance: number, cost: number): number => {
  if (!Number.isFinite(balance) || !Number.isFinite(cost) || cost <= 0 || balance <= 0) return 0;
  return Math.floor(balance / cost);
};

/** Lê o custo por foto de app_settings.value (jsonb pode vir como número ou texto). */
export const parseCreditCost = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.trim()) : typeof value === 'number' ? value : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/** Valida a quantidade do ajuste: inteiro com sinal, diferente de zero. */
export const parseAdjustAmount = (raw: string): ParseResult => {
  const s = raw.trim().replace('−', '-');
  if (!/^[+-]?\d+$/.test(s)) return { ok: false, error: 'Informe um número inteiro (ex.: 30 ou -10).' };
  const n = Number(s);
  if (n === 0) return { ok: false, error: 'A quantidade não pode ser zero.' };
  if (Math.abs(n) > 1_000_000) return { ok: false, error: 'Quantidade muito alta.' };
  return { ok: true, value: n };
};

/** Valida o novo custo por foto: inteiro positivo. */
export const parseCostInput = (raw: string): ParseResult => {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return { ok: false, error: 'Informe um número inteiro positivo.' };
  const n = Number(s);
  if (n <= 0) return { ok: false, error: 'O custo deve ser maior que zero.' };
  if (n > 100_000) return { ok: false, error: 'Valor muito alto.' };
  return { ok: true, value: n };
};

/** Mensagem amigável para erros das RPCs de créditos. */
export const creditErrorMessage = (message: string | null | undefined): string => {
  const m = message || '';
  if (m.includes('insufficient_credits')) return 'Saldo insuficiente: o saldo não pode ficar negativo.';
  if (m.includes('note_required')) return 'A nota é obrigatória.';
  if (m.includes('admin_only')) return 'Apenas administradores podem ajustar créditos.';
  if (m.includes('user_not_found')) return 'Atleta não encontrado.';
  if (m.includes('invalid_delta')) return 'Quantidade inválida.';
  return m || 'Não foi possível concluir a operação.';
};
