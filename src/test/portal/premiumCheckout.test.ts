import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));

import { apiCreatePremiumCheckout } from '@/lib/creditsApi';

describe('apiCreatePremiumCheckout', () => {
  beforeEach(() => invoke.mockReset());

  it('devuelve la URL de checkout', async () => {
    invoke.mockResolvedValue({ data: { checkout_url: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1' }, error: null });
    expect(await apiCreatePremiumCheckout()).toBe('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1');
    expect(invoke).toHaveBeenCalledWith('create-premium-checkout', { body: {} });
  });

  it('propaga el error de la función', async () => {
    const err = new Error('boom');
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(apiCreatePremiumCheckout()).rejects.toBe(err);
  });

  it('rechaza una URL ausente o no https', async () => {
    invoke.mockResolvedValue({ data: { checkout_url: 'http://evil' }, error: null });
    await expect(apiCreatePremiumCheckout()).rejects.toThrow('invalid_checkout_url');
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(apiCreatePremiumCheckout()).rejects.toThrow('invalid_checkout_url');
  });
});
