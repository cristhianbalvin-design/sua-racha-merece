/** Créditos: saldo, histórico, ajustes (admin) e custo por foto. */
import { supabase } from '@/lib/supabase';
import { parseCreditCost } from '@/lib/credits';

export const PHOTO_CREDIT_COST_KEY = 'photo_credit_cost';

export interface LedgerRow {
  id: number;
  delta: number;
  balance_after: number;
  reason: string;
  note: string | null;
  ref_type: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AthleteSummary {
  id: string;
  name: string | null;
  email: string | null;
  plan: string | null;
  premium_since: string | null;
  premium_until: string | null;
}

const LEDGER_COLUMNS = 'id, delta, balance_after, reason, note, ref_type, created_by, created_at';

// ----- Atleta -----

export const apiGetMyCreditBalance = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('get_my_credit_balance');
  if (error) throw error;
  return Number(data ?? 0);
};

export const apiGetPhotoCreditCost = async (): Promise<number | null> => {
  const { data, error } = await supabase.rpc('get_photo_credit_cost');
  if (error) throw error;
  return parseCreditCost(data);
};

export const apiIsPremium = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_premium');
  if (error) throw error;
  return data === true;
};

export const apiGetMyPlan = async (userId: string): Promise<{ plan: string | null; premium_until: string | null } | null> => {
  const { data, error } = await supabase.from('users').select('plan, premium_until').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as { plan: string | null; premium_until: string | null } | null;
};

/** Histórico de um usuário (a RLS limita ao próprio, ou a qualquer um para o admin). */
export const apiGetLedger = async (
  userId: string,
  from: number,
  to: number,
): Promise<{ rows: LedgerRow[]; total: number }> => {
  const { data, error, count } = await supabase
    .from('credit_ledger')
    .select(LEDGER_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as LedgerRow[], total: count ?? 0 };
};

// ----- Admin -----

/** Remove caracteres que quebram o filtro `or` do PostgREST. */
const sanitizeSearch = (q: string): string => q.replace(/[,()%*\\]/g, ' ').trim();

export const apiSearchAthletes = async (query: string): Promise<AthleteSummary[]> => {
  const q = sanitizeSearch(query);
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, plan, premium_since, premium_until')
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return (data ?? []) as AthleteSummary[];
};

export const apiGetUserBalance = async (userId: string): Promise<number> => {
  const { data, error } = await supabase.from('credit_balances').select('balance').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Number((data as { balance?: number } | null)?.balance ?? 0);
};

export const apiAdminAdjustCredits = async (
  userId: string,
  delta: number,
  note: string,
): Promise<{ balance: number; duplicate: boolean; ledger_id: number | null }> => {
  const { data, error } = await supabase.rpc('admin_adjust_credits', { p_user_id: userId, p_delta: delta, p_note: note });
  if (error) throw error;
  const d = (data ?? {}) as { balance?: number; duplicate?: boolean; ledger_id?: number };
  return { balance: Number(d.balance ?? 0), duplicate: d.duplicate === true, ledger_id: d.ledger_id ?? null };
};

export const apiGetPhotoCreditCostSetting = async (): Promise<number | null> => {
  const { data, error } = await supabase.from('app_settings').select('key, value').eq('key', PHOTO_CREDIT_COST_KEY).maybeSingle();
  if (error) throw error;
  return parseCreditCost((data as { value?: unknown } | null)?.value);
};

export const apiSetPhotoCreditCost = async (cost: number): Promise<void> => {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: PHOTO_CREDIT_COST_KEY, value: cost, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
};
