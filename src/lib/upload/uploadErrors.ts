/**
 * Erros do envio de fotos e a regra de quais podem ser repetidos.
 * Só falhas transitórias (rede, 5xx, 502 do reconhecimento facial, 429) são repetidas.
 */

export type UploadErrorKind =
  | 'transient'
  | 'invalid'
  | 'too_large'
  | 'unsupported'
  | 'forbidden'
  | 'terms'
  | 'auth'
  | 'aborted'
  | 'unknown';

export class UploadError extends Error {
  readonly kind: UploadErrorKind;
  readonly status?: number;

  constructor(kind: UploadErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'UploadError';
    this.kind = kind;
    this.status = status;
  }
}

export const isRetryableError = (err: UploadError): boolean => err.kind === 'transient';

/** Erros que devem parar o lote inteiro (não adianta continuar enviando). */
export const isHaltingError = (err: UploadError): boolean => err.kind === 'terms' || err.kind === 'auth';

const bodyMessage = (body: unknown): string => {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = b.error ?? b.message ?? b.msg;
    if (typeof msg === 'string') return msg;
  }
  return '';
};

/** Converte uma resposta HTTP sem sucesso da Edge Function em UploadError. */
export const errorFromResponse = (status: number, body: unknown): UploadError => {
  const msg = bodyMessage(body);
  if (status === 401) return new UploadError('auth', 'Sua sessão expirou. Entre novamente para continuar.', status);
  if (status === 403 && msg === 'terms_not_accepted') {
    return new UploadError('terms', 'Você precisa aceitar os Termos do Fotógrafo antes de enviar fotos.', status);
  }
  if (status === 403) return new UploadError('forbidden', 'Esta conta não tem permissão para enviar fotos.', status);
  if (status === 413) return new UploadError('too_large', 'Acima de 20 MB. Reduza o tamanho e envie de novo.', status);
  if (status === 415) return new UploadError('unsupported', 'Formato não suportado. Use JPEG, PNG ou WEBP.', status);
  if (status === 400) return new UploadError('invalid', msg ? `Dados inválidos: ${msg}` : 'Dados inválidos.', status);
  if (status === 429) return new UploadError('transient', 'Muitos envios ao mesmo tempo (429).', status);
  if (status === 502) return new UploadError('transient', 'O serviço de reconhecimento facial não respondeu (502).', status);
  if (status >= 500) return new UploadError('transient', `Erro no servidor (${status}).`, status);
  return new UploadError('unknown', msg || `Erro inesperado (${status}).`, status);
};

/** Converte qualquer exceção (rede, abort, UploadError) em UploadError. */
export const toUploadError = (err: unknown): UploadError => {
  if (err instanceof UploadError) return err;
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
    return new UploadError('aborted', 'Envio cancelado.');
  }
  // fetch rejeita com TypeError quando a conexão cai ou o servidor não responde.
  if (err instanceof TypeError) return new UploadError('transient', 'Conexão interrompida.');
  const message = err instanceof Error ? err.message : String(err);
  return new UploadError('unknown', message || 'Erro desconhecido.');
};
