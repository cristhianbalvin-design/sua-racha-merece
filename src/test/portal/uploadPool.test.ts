import { describe, expect, it, vi } from 'vitest';
import { UploadPool } from '@/lib/upload/uploadPool';
import { createEdgeUploader, type EventUploadFields } from '@/lib/upload/edgeUpload';
import { UploadError, errorFromResponse, toUploadError } from '@/lib/upload/uploadErrors';

const fields: EventUploadFields = { region_id: 'r1', sport_id: 's1', city: 'São Paulo', event_date: '2026-09-14' };

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const okResponse = (id: string) => jsonResponse(200, { success: true, photo: { id, image_url: `https://x/${id}.jpg`, status: 'pending' } });

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Monta um pool que usa o uploader real com fetch simulado. */
const makePool = (fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof UploadPool>[0]> = {}) => {
  const upload = createEdgeUploader({
    functionUrl: 'https://proj.supabase.co/functions/v1/upload-event-photo',
    getAccessToken: async () => 'token-123',
    fetchImpl,
  });
  const sleeps: number[] = [];
  const pool = new UploadPool<{ name: string }, unknown>({
    upload: (item, signal) => upload(new Blob(['x']), item.name, fields, signal),
    backoff: (n) => n * 100,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...(extra as object),
  });
  return { pool, sleeps };
};

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, item: { name: `IMG_${i}.jpg` } }));

describe('createEdgeUploader', () => {
  it('envia multipart com token e sem photographer_id', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => okResponse('p1'));
    const upload = createEdgeUploader({ functionUrl: 'https://u/fn', getAccessToken: async () => 'abc', fetchImpl: fetchMock as unknown as typeof fetch });
    const photo = await upload(new Blob(['x']), 'a.jpg', fields);
    expect(photo.id).toBe('p1');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
    const body = init.body as FormData;
    expect(body.get('region_id')).toBe('r1');
    expect(body.get('event_date')).toBe('2026-09-14');
    expect(body.has('photographer_id')).toBe(false);
    expect(body.get('file')).toBeTruthy();
  });

  it('sem sessão gera erro de autenticação sem chamar a função', async () => {
    const fetchMock = vi.fn();
    const upload = createEdgeUploader({ functionUrl: 'https://u/fn', getAccessToken: async () => null, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(upload(new Blob(['x']), 'a.jpg', fields)).rejects.toMatchObject({ kind: 'auth' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('classificação de erros', () => {
  it('mapeia status HTTP', () => {
    expect(errorFromResponse(502, {}).kind).toBe('transient');
    expect(errorFromResponse(500, {}).kind).toBe('transient');
    expect(errorFromResponse(503, {}).kind).toBe('transient');
    expect(errorFromResponse(400, { error: 'region_id inválido' }).kind).toBe('invalid');
    expect(errorFromResponse(413, {}).kind).toBe('too_large');
    expect(errorFromResponse(401, {}).kind).toBe('auth');
    expect(errorFromResponse(403, { error: 'terms_not_accepted' }).kind).toBe('terms');
    expect(errorFromResponse(403, { error: 'Forbidden' }).kind).toBe('forbidden');
  });
  it('falha de rede é transitória e abort é aborted', () => {
    expect(toUploadError(new TypeError('Failed to fetch')).kind).toBe('transient');
    expect(toUploadError(new DOMException('x', 'AbortError')).kind).toBe('aborted');
  });
});

describe('UploadPool', () => {
  it('nunca passa de 3 envios simultâneos e despacha o próximo assim que um termina', async () => {
    const pending: Array<ReturnType<typeof deferred<Response>>> = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn(() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const d = deferred<Response>();
      pending.push(d);
      return d.promise.finally(() => {
        inFlight--;
      });
    });
    const { pool } = makePool(fetchMock as unknown as typeof fetch);
    pool.add(items(6));
    const done = pool.run();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Só o segundo termina: o 4º começa sem esperar o 1º e o 3º (pool real, não blocos).
    pending[1].resolve(okResponse('b'));
    await tick();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // Libera tudo.
    for (let round = 0; round < 6; round++) {
      pending.forEach((d, i) => d.resolve(okResponse(`p${i}`)));
      await tick();
      await tick();
    }
    await done;
    expect(maxInFlight).toBe(3);
    expect(pool.counts().success).toBe(6);
    expect(pool.state).toBe('done');
  });

  it('repete até 3 vezes erros transitórios (502/5xx/rede) com backoff', async () => {
    const responses = [jsonResponse(502, { error: 'face' }), jsonResponse(503, {}), null, okResponse('ok')];
    let call = 0;
    const fetchMock = vi.fn(async () => {
      const r = responses[call++];
      if (r === null) throw new TypeError('Failed to fetch');
      return r;
    });
    const { pool, sleeps } = makePool(fetchMock as unknown as typeof fetch);
    pool.add(items(1));
    await pool.run();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([100, 200, 300]);
    expect(pool.getJob('f0')?.status).toBe('success');
  });

  it('desiste após 3 repetições e marca erro', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(502, { error: 'x' }));
    const { pool } = makePool(fetchMock as unknown as typeof fetch);
    pool.add(items(1));
    await pool.run();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const job = pool.getJob('f0');
    expect(job?.status).toBe('error');
    expect(job?.error?.status).toBe(502);
  });

  it('não repete 400 nem 413', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(400, { error: 'city obrigatória' }))
      .mockResolvedValueOnce(jsonResponse(413, { error: 'too large' }));
    const { pool, sleeps } = makePool(fetchMock as unknown as typeof fetch, { concurrency: 1 });
    pool.add(items(2));
    await pool.run();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([]);
    expect(pool.getJob('f0')?.error?.kind).toBe('invalid');
    expect(pool.getJob('f1')?.error?.kind).toBe('too_large');
  });

  it('para o lote inteiro com 403 terms_not_accepted', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(403, { error: 'terms_not_accepted' }));
    const onHalt = vi.fn();
    const { pool } = makePool(fetchMock as unknown as typeof fetch, { concurrency: 1, onHalt });
    pool.add(items(5));
    await pool.run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onHalt).toHaveBeenCalledTimes(1);
    expect(onHalt.mock.calls[0][0]).toBeInstanceOf(UploadError);
    expect(pool.state).toBe('halted');
    expect(pool.haltError?.kind).toBe('terms');
    // Nada se perde: as fotos voltam/ficam na fila para quando os termos forem aceitos.
    expect(pool.counts().queued).toBe(5);
  });

  it('para o lote com 401 e aborta os envios em andamento', async () => {
    const signals: AbortSignal[] = [];
    let call = 0;
    const fetchMock = vi.fn((_u: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init!.signal!);
      call++;
      if (call === 1) return Promise.resolve(jsonResponse(401, { error: 'Unauthorized' }));
      return new Promise<Response>((_res, rej) => {
        init!.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      });
    });
    const { pool } = makePool(fetchMock as unknown as typeof fetch);
    pool.add(items(4));
    await pool.run();
    expect(pool.haltError?.kind).toBe('auth');
    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(pool.counts().queued).toBe(4);
    expect(pool.counts().success).toBe(0);
  });

  it('pausar deixa de despachar novos envios e retomar continua', async () => {
    const pending: Array<ReturnType<typeof deferred<Response>>> = [];
    const fetchMock = vi.fn(() => {
      const d = deferred<Response>();
      pending.push(d);
      return d.promise;
    });
    const { pool } = makePool(fetchMock as unknown as typeof fetch, { concurrency: 2 });
    pool.add(items(4));
    const done = pool.run();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    pool.pause();
    pending[0].resolve(okResponse('a'));
    pending[1].resolve(okResponse('b'));
    await tick();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pool.state).toBe('paused');
    expect(pool.counts().success).toBe(2);

    pool.resume();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    pending[2].resolve(okResponse('c'));
    pending[3].resolve(okResponse('d'));
    await done;
    expect(pool.counts().success).toBe(4);
  });

  it('cancelar aborta os envios em andamento e cancela a fila', async () => {
    const fetchMock = vi.fn(
      (_u: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init!.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
        }),
    );
    const { pool } = makePool(fetchMock as unknown as typeof fetch);
    pool.add(items(5));
    const done = pool.run();
    await tick();
    pool.cancel();
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(pool.counts().cancelled).toBe(5);
    expect(pool.state).toBe('cancelled');
  });

  it('cancelar durante a pausa encerra o lote', async () => {
    const fetchMock = vi.fn(async () => okResponse('x'));
    const { pool } = makePool(fetchMock as unknown as typeof fetch, { concurrency: 1 });
    pool.add(items(3));
    pool.pause(); // sem efeito antes de iniciar
    const done = pool.run();
    pool.pause();
    await tick();
    await tick();
    pool.cancel();
    await done;
    expect(pool.state).toBe('cancelled');
    expect(pool.counts().success + pool.counts().cancelled).toBe(3);
  });

  it('"Tentar novamente" reenvia só os com erro', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse('a'))
      .mockResolvedValueOnce(jsonResponse(400, { error: 'x' }))
      .mockResolvedValueOnce(okResponse('b'));
    const { pool } = makePool(fetchMock as unknown as typeof fetch, { concurrency: 1 });
    pool.add(items(2));
    await pool.run();
    expect(pool.counts().error).toBe(1);
    await pool.retry(['f1']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(pool.counts().success).toBe(2);
    expect(pool.counts().error).toBe(0);
  });
});
