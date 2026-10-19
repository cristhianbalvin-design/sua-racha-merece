import { UploadError, errorFromResponse } from './uploadErrors';

/** Dados do evento enviados junto com cada foto. */
export interface EventUploadFields {
  region_id: string;
  sport_id: string;
  city: string;
  /** YYYY-MM-DD */
  event_date: string;
}

export interface UploadedPhoto {
  id: string;
  image_url: string;
  status: string;
}

export interface EdgeUploaderOptions {
  functionUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export type EdgeUploader = (
  file: Blob,
  fileName: string,
  fields: EventUploadFields,
  signal?: AbortSignal,
) => Promise<UploadedPhoto>;

/**
 * Cria a função que envia UMA foto para a Edge Function upload-event-photo.
 * Para fotógrafos o photographer_id não é enviado: a função usa o da conta logada.
 */
export const createEdgeUploader = ({ functionUrl, getAccessToken, fetchImpl }: EdgeUploaderOptions): EdgeUploader => {
  return async (file, fileName, fields, signal) => {
    const token = await getAccessToken();
    if (!token) throw new UploadError('auth', 'Sua sessão expirou. Entre novamente para continuar.', 401);

    const form = new FormData();
    form.append('file', file, fileName);
    form.append('region_id', fields.region_id);
    form.append('sport_id', fields.sport_id);
    form.append('city', fields.city);
    form.append('event_date', fields.event_date);

    const doFetch = fetchImpl ?? fetch;
    const response = await doFetch(functionUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal,
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) throw errorFromResponse(response.status, body);

    const photo = (body as { photo?: UploadedPhoto } | null)?.photo;
    if (!photo || !photo.id) throw new UploadError('unknown', 'Resposta inesperada do servidor.', response.status);
    return photo;
  };
};
