/** Interpretação das respostas da Edge Function invite-photographer (sem Supabase, testável). */

export type InviteErrorKind = 'invalid_email' | 'not_found' | 'already_has_account' | 'email_registered' | 'not_deployed' | 'forbidden' | 'unknown';

export interface InviteErrorInfo {
  kind: InviteErrorKind;
  message: string;
}

const bodyText = (body: unknown): string => {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const v = b.error ?? b.message ?? b.msg;
    if (typeof v === 'string') return v;
  }
  return typeof body === 'string' ? body : '';
};

/**
 * Converte status + corpo da resposta em uma mensagem clara para o admin.
 * status null = a requisição nem chegou (rede/CORS), o que costuma indicar função não implantada.
 */
export const interpretInviteError = (status: number | null, body: unknown, errorName?: string): InviteErrorInfo => {
  const text = bodyText(body);
  const code = body && typeof body === 'object' ? (body as Record<string, unknown>).code : undefined;

  if (status === null || errorName === 'FunctionsFetchError' || errorName === 'FunctionsRelayError') {
    return {
      kind: 'not_deployed',
      message: 'Não foi possível contatar a função invite-photographer. Verifique se ela já foi implantada no Supabase.',
    };
  }
  if (status === 404 && (code === 'NOT_FOUND' || /function was not found/i.test(text))) {
    return { kind: 'not_deployed', message: 'A função invite-photographer ainda não foi implantada no Supabase.' };
  }
  if (status === 404) return { kind: 'not_found', message: 'Fotógrafo não encontrado. Atualize a lista e tente de novo.' };
  if (status === 400) return { kind: 'invalid_email', message: 'E-mail inválido. Confira o endereço e tente de novo.' };
  if (status === 409 && /already has an account/i.test(text)) {
    return { kind: 'already_has_account', message: 'Este fotógrafo já tem uma conta de acesso.' };
  }
  if (status === 409 && /already registered/i.test(text)) {
    return {
      kind: 'email_registered',
      message: 'Este e-mail já está cadastrado na plataforma (por exemplo, como atleta). Use outro e-mail.',
    };
  }
  if (status === 409) return { kind: 'unknown', message: text || 'Conflito ao criar o acesso.' };
  if (status === 401 || status === 403) return { kind: 'forbidden', message: 'Apenas administradores podem convidar fotógrafos.' };
  return { kind: 'unknown', message: text ? `Erro ao convidar: ${text}` : `Erro ao convidar (${status}).` };
};

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
