import { describe, expect, it } from 'vitest';
import { parseLinkError, sponsorAccessView } from './sponsorAccess';

describe('acesso do patrocinador', () => {
  it('identifica erros no hash e na query', () => {
    expect(parseLinkError('', '#error=access_denied&error_code=otp_expired')).toBe('otp_expired');
    expect(parseLinkError('?error=access_denied', '')).toBe('access_denied');
    expect(parseLinkError('', '#access_token=abc')).toBeNull();
  });

  it('exige um link válido e uma sessão para criar senha', () => {
    expect(sponsorAccessView('', '#access_token=abc', true)).toBe('password');
    expect(sponsorAccessView('?code=abc', '', true)).toBe('password');
    expect(sponsorAccessView('?code=abc', '', false)).toBe('request');
    expect(sponsorAccessView('', '', true)).toBe('request');
    expect(sponsorAccessView('?error_code=otp_expired', '#access_token=abc', true)).toBe('request');
  });
});
