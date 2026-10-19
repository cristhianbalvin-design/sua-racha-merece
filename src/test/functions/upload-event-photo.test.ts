import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock global fetch y Deno.env
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

global.Deno = {
  env: {
    get: vi.fn((key) => {
      if (key === 'SERVICE_SECRET') return 'secret';
      if (key === 'RAILWAY_SERVICE_URL') return 'http://railway.test';
      return 'test-key';
    }),
  },
} as any;

vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789abc');

// 2. Mock del cliente Supabase (users / photographers / event_photos + storage)
const REGION_ID = '11111111-1111-4111-8111-111111111111';
const SPORT_ID = '22222222-2222-4222-8222-222222222222';
const BODY_PHOTOGRAPHER_ID = '33333333-3333-4333-8333-333333333333'; // el que envía el admin en el form
const OWN_PHOTOGRAPHER_ID = '44444444-4444-4444-8444-444444444444'; // el del fotógrafo logueado
const EXPECTED_PATH = '2026-07-31/12345678-1234-1234-1234-123456789abc.jpg';

const state = {
  role: 'ADMIN' as string,
  photographer: null as null | { id: string; terms_accepted_at: string | null },
  insertResult: { data: { id: 'photo-1' }, error: null } as { data: unknown; error: unknown },
};
const insertSpy = vi.fn();
const eventPhotoSelects: string[] = [];

const makeBuilder = (table: string) => {
  const b: any = {};
  b.select = vi.fn((cols: string) => {
    if (table === 'event_photos') eventPhotoSelects.push(cols);
    return b;
  });
  b.eq = vi.fn(() => b);
  b.maybeSingle = vi.fn(async () =>
    table === 'users'
      ? { data: { role: state.role }, error: null }
      : { data: state.photographer, error: null },
  );
  b.insert = vi.fn((row: unknown) => {
    insertSpy(row);
    return b;
  });
  b.single = vi.fn(async () => state.insertResult);
  return b;
};

const storage = {
  from: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
};
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn((table: string) => makeBuilder(table)),
  storage,
};
const createClientMock = vi.fn(() => mockSupabaseClient);

// 3. Extraer y cargar el handler del archivo Deno (compilando TypeScript a JS)
const filePath = path.resolve(__dirname, '../../../supabase/functions/upload-event-photo/index.ts');
let code = fs.readFileSync(filePath, 'utf-8');
code = code.replace(/import .*;/g, '');
code = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;

let handler: (req: Request) => Promise<Response>;
const serveMock = (fn: any) => { handler = fn; };

const evalContext = new Function('serve', 'createClient', 'Deno', 'fetch', 'FormData', 'File', 'crypto', code);
evalContext(serveMock, createClientMock, global.Deno, global.fetch, FormData, File, global.crypto);

// Helpers
const buildRequest = (formData?: FormData, withAuth = true) => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: withAuth ? { Authorization: 'Bearer token' } : {},
  });
  if (formData) req.formData = async () => formData;
  return req;
};

const buildForm = (opts: { file?: File; photographerId?: string } = {}) => {
  const fd = new FormData();
  fd.append('file', opts.file ?? new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
  fd.append('region_id', REGION_ID);
  fd.append('sport_id', SPORT_ID);
  fd.append('city', 'são paulo');
  fd.append('photographer_id', opts.photographerId ?? BODY_PHOTOGRAPHER_ID);
  fd.append('event_date', '2026-07-31');
  return fd;
};

describe('upload-event-photo Edge Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    state.role = 'ADMIN';
    state.photographer = null;
    state.insertResult = { data: { id: 'photo-1' }, error: null };
    eventPhotoSelects.length = 0;

    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSupabaseClient.from.mockImplementation((table: string) => makeBuilder(table));

    storage.from.mockReturnValue(storage);
    storage.upload.mockResolvedValue({ data: { path: 'test.jpg' }, error: null });
    storage.getPublicUrl.mockReturnValue({ data: { publicUrl: 'http://bucket/test.jpg' } });
    storage.remove.mockResolvedValue({ data: null, error: null });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    } as any);
  });

  describe('acceso', () => {
    it('responde 401 si falta el header Authorization', async () => {
      const res = await handler(buildRequest(undefined, false));
      expect(res.status).toBe(401);
    });

    it('responde 403 si no es admin ni fotógrafo', async () => {
      state.role = 'USUARIO';
      state.photographer = null;
      const res = await handler(buildRequest(buildForm()));
      expect(res.status).toBe(403);
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('responde 403 terms_not_accepted si el fotógrafo no aceptó los términos', async () => {
      state.role = 'USUARIO';
      state.photographer = { id: OWN_PHOTOGRAPHER_ID, terms_accepted_at: null };
      const res = await handler(buildRequest(buildForm()));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('terms_not_accepted');
      expect(mockFetch).not.toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  describe('admin', () => {
    it('sube la foto, usa el photographer_id del formulario y la publica', async () => {
      const res = await handler(buildRequest(buildForm()));
      expect(res.status).toBe(200);

      expect(mockFetch).toHaveBeenCalledWith('http://railway.test/embed', expect.objectContaining({
        method: 'POST',
        headers: { 'X-Service-Secret': 'secret' },
      }));
      expect(storage.upload).toHaveBeenCalledWith(EXPECTED_PATH, expect.any(File), { contentType: 'image/jpeg', upsert: false });
      expect(insertSpy).toHaveBeenCalledWith({
        campaign_id: null,
        image_url: 'http://bucket/test.jpg',
        embedding: '[0.1,0.2,0.3]',
        region_id: REGION_ID,
        sport_id: SPORT_ID,
        city: 'São Paulo',
        photographer_id: BODY_PHOTOGRAPHER_ID,
        event_date: '2026-07-31',
        status: 'published',
        uploaded_by_photographer: false,
      });
      expect(eventPhotoSelects).toEqual(['*']);
    });

    it('responde 400 si el photographer_id del formulario no es un UUID', async () => {
      const res = await handler(buildRequest(buildForm({ photographerId: 'photographer-123' })));
      expect(res.status).toBe(400);
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  describe('fotógrafo', () => {
    beforeEach(() => {
      state.role = 'USUARIO';
      state.photographer = { id: OWN_PHOTOGRAPHER_ID, terms_accepted_at: '2026-10-01T00:00:00Z' };
    });

    it('guarda la foto como pending con su propio id (ignora el del body) y no devuelve el embedding', async () => {
      const res = await handler(buildRequest(buildForm({ photographerId: BODY_PHOTOGRAPHER_ID })));
      expect(res.status).toBe(200);

      expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
        photographer_id: OWN_PHOTOGRAPHER_ID,
        status: 'pending',
        uploaded_by_photographer: true,
        embedding: '[0.1,0.2,0.3]',
      }));
      expect(eventPhotoSelects).toHaveLength(1);
      expect(eventPhotoSelects[0]).not.toContain('embedding');
      expect(eventPhotoSelects[0]).not.toBe('*');
    });

    it('rechaza tipos de archivo no permitidos con 400', async () => {
      const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
      const res = await handler(buildRequest(buildForm({ file: gif })));
      expect(res.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rechaza archivos de más de 20 MB con 413', async () => {
      const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 });
      const res = await handler(buildRequest(buildForm({ file: big })));
      expect(res.status).toBe(413);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('reconocimiento facial (Railway)', () => {
    it('responde 502 y no sube nada si Railway falla (incluye "No face detected")', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'No face detected in image',
      } as any);

      const res = await handler(buildRequest(buildForm()));
      expect(res.status).toBe(502);
      expect(storage.upload).not.toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  describe('integridad', () => {
    it('borra el archivo de Storage si falla el insert en la base de datos', async () => {
      state.insertResult = { data: null, error: new Error('DB constraint failed') };

      const res = await handler(buildRequest(buildForm()));
      expect(res.status).toBe(500);
      expect(storage.remove).toHaveBeenCalledWith([EXPECTED_PATH]);
    });
  });
});
