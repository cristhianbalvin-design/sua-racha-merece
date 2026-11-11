/**
 * Saldo en reales (paso 27). Reemplaza a los créditos: el Premium acredita R$50, hay recargas de
 * R$20/30/50 y cada foto sin cupo gratis cuesta R$10 del saldo. Lo usan la web, la app y el admin.
 */
import { supabase } from '@/lib/supabase';

export const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const PREMIUM_PRICE_CENTS = 5000;

export interface WalletMovement {
  id: number;
  delta_cents: number;
  reason: 'premium_bonus' | 'topup' | 'photo_purchase' | 'payment_reverted' | 'admin_refund' | 'admin_adjustment';
  note: string | null;
  ref_type: string | null;
  created_at: string;
  balance_after_cents?: number;
}

export interface MyWallet {
  balance_cents: number;
  premium: { active: boolean; since: string | null; until: string | null } | null;
  premium_price_cents: number;
  topup_options: number[];
  photo_price_cents: number;
  movements: WalletMovement[];
}

export const walletReasonLabel = (r: WalletMovement['reason'] | string): string =>
  ({
    premium_bonus: 'Saldo do Premium',
    topup: 'Recarga',
    photo_purchase: 'Compra de foto',
    payment_reverted: 'Pagamento estornado',
    admin_refund: 'Devolução',
    admin_adjustment: 'Ajuste da 3buk',
  })[r] ?? 'Movimento';

export const formatCents = (delta: number) => `${delta > 0 ? '+' : '−'}${brl(Math.abs(delta))}`;

export async function apiGetMyWallet(): Promise<MyWallet> {
  const { data, error } = await supabase.rpc('get_my_wallet');
  if (error) throw error;
  const w = (data ?? {}) as Partial<MyWallet>;
  return {
    balance_cents: Number(w.balance_cents ?? 0),
    premium: w.premium ?? null,
    premium_price_cents: Number(w.premium_price_cents ?? PREMIUM_PRICE_CENTS),
    topup_options: Array.isArray(w.topup_options) ? w.topup_options.map(Number) : [2000, 3000, 5000],
    photo_price_cents: Number(w.photo_price_cents ?? 1000),
    movements: (w.movements ?? []) as WalletMovement[],
  };
}

/**
 * Abre el pago en Mercado Pago. premium_annual: R$50 (siempre dinero nuevo, nunca saldo).
 * wallet_topup: solo los montos permitidos (el servidor lo valida). Devuelve la URL de pago.
 */
export async function apiCreateCheckout(input: { product: 'premium_annual' | 'wallet_topup'; amountCents?: number; returnTo?: 'app' | 'web' }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-premium-checkout', {
    body: { product: input.product, amount_cents: input.amountCents, return_to: input.returnTo ?? 'web' },
  });
  if (error) throw error;
  const url = (data as { checkout_url?: unknown } | null)?.checkout_url;
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('invalid_checkout_url');
  return url;
}

/** Respaldo del webhook: verifica con Mercado Pago los pagos pendientes (Premium y recargas). */
export async function apiSyncPayments(): Promise<{ applied: boolean }> {
  const { data, error } = await supabase.functions.invoke('sync-premium-payment', { body: {} });
  if (error) throw error;
  return { applied: (data as { applied?: unknown } | null)?.applied === true };
}

// ----- Admin -----

export async function apiAdminGetWallet(userId: string): Promise<{ balance_cents: number; movements: WalletMovement[] }> {
  const [{ data: b, error: be }, { data: l, error: le }] = await Promise.all([
    supabase.from('wallet_balances').select('balance_cents').eq('user_id', userId).maybeSingle(),
    supabase
      .from('wallet_ledger')
      .select('id, delta_cents, balance_after_cents, reason, note, ref_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  if (be) throw be;
  if (le) throw le;
  return { balance_cents: Number((b as { balance_cents?: number } | null)?.balance_cents ?? 0), movements: (l ?? []) as WalletMovement[] };
}

/** Devolución (negativo, marcada como devolución) o ajuste manual. Siempre con motivo. */
export async function apiAdminWalletAdjust(userId: string, deltaCents: number, note: string, refund: boolean): Promise<number> {
  const { data, error } = await supabase.rpc('admin_wallet_adjust', { p_user_id: userId, p_delta_cents: deltaCents, p_note: note, p_refund: refund });
  if (error) throw error;
  return Number((data as { balance_cents?: number } | null)?.balance_cents ?? 0);
}

export async function apiGetPhotoPriceCents(): Promise<number> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'photo_price_cents').maybeSingle();
  if (error) throw error;
  return Number((data as { value?: unknown } | null)?.value ?? 1000);
}

export async function apiSetPhotoPriceCents(cents: number): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'photo_price_cents', value: cents, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

/** Recargas expresadas en reales enteros. */
export function topupCents(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 10 && amount <= 200 ? amount * 100 : null;
}
