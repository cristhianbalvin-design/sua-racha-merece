import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock global fetch and Deno.env
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

global.Deno = {
  env: {
    get: vi.fn((key) => {
      if (key === 'SERVICE_SECRET') return 'secret';
      if (key === 'RAILWAY_SERVICE_URL') return 'http://railway.test';
      return 'test-key';
    })
  }
} as any;

vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789abc');

// 2. Mock Supabase Client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
  storage: {
    from: vi.fn(),
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    remove: vi.fn(),
  }
};

const createClientMock = vi.fn(() => mockSupabaseClient);

// 3. Extract and load the handler from the Deno file
const filePath = path.resolve(__dirname, '../../../supabase/functions/upload-event-photo/index.ts');
let code = fs.readFileSync(filePath, 'utf-8');

// Strip out imports
code = code.replace(/import .*;/g, '');

// Capture the handler passed to `serve`
let handler: (req: Request) => Promise<Response>;
const serveMock = (fn: any) => { handler = fn; };

// Evaluate the code in this context
const evalContext = new Function('serve', 'createClient', 'Deno', 'fetch', 'FormData', 'File', 'crypto', code);
evalContext(serveMock, createClientMock, global.Deno, global.fetch, FormData, File, global.crypto);

describe('upload-event-photo Edge Function', () => {
  const appendRequiredMetadata = (formData: FormData) => {
    formData.append('region_id', 'region-123');
    formData.append('sport_id', 'sport-123');
    formData.append('city', 'São Paulo');
    formData.append('photographer_id', 'photographer-123');
    formData.append('event_date', '2026-07-31');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default valid auth
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin1' } }, error: null });
    
    // Default role query chain setup (builder pattern)
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockResolvedValue({ data: { role: 'ADMIN' }, error: null });
    
    // DB Insert setup
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);

    // Storage setup
    mockSupabaseClient.storage.from.mockReturnValue(mockSupabaseClient.storage);
    mockSupabaseClient.storage.upload.mockResolvedValue({ data: { path: 'test.jpg' }, error: null });
    mockSupabaseClient.storage.getPublicUrl.mockReturnValue({ data: { publicUrl: 'http://bucket/test.jpg' } });
    mockSupabaseClient.storage.remove.mockResolvedValue({ data: null, error: null });

    // Fetch setup
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] })
    } as any);
  });

  it('rejects a non-admin user with 403', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { role: 'USER' }, error: null });

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token' }
    });
    
    const res = await handler(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden: Admins only');
  });

  it('completes the happy path correctly', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
    appendRequiredMetadata(formData);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token' }
    });
    req.formData = async () => formData;

    const res = await handler(req);
    expect(res.status).toBe(200);

    // Check fetch to Railway
    expect(mockFetch).toHaveBeenCalledWith('http://railway.test/embed', expect.objectContaining({
      method: 'POST',
      headers: { 'X-Service-Secret': 'secret' }
    }));

    // Check storage upload
    expect(mockSupabaseClient.storage.upload).toHaveBeenCalledWith('2026-07-31/12345678-1234-1234-1234-123456789abc.jpg', expect.any(File), { contentType: 'image/jpeg', upsert: false });

    // Check DB insert
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
      campaign_id: null,
      image_url: 'http://bucket/test.jpg',
      embedding: '[0.1,0.2,0.3]',
      region_id: 'region-123',
      sport_id: 'sport-123',
      city: 'São Paulo',
      photographer_id: 'photographer-123',
      event_date: '2026-07-31',
    });
  });

  it('rolls back storage upload if database insert fails', async () => {
    // Override insert to throw an error
    mockSupabaseClient.single
      // First call is for role check (ADMIN) -> return success
      .mockResolvedValueOnce({ data: { role: 'ADMIN' }, error: null })
      // Second call is for DB insert single() -> return error
      .mockResolvedValueOnce({ data: null, error: new Error('DB constraint failed') });

    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
    appendRequiredMetadata(formData);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token' }
    });
    req.formData = async () => formData;

    const res = await handler(req);
    
    // Expect internal server error because insert failed
    expect(res.status).toBe(500);

    // Ensure rollback was called
    expect(mockSupabaseClient.storage.remove).toHaveBeenCalledWith(['2026-07-31/12345678-1234-1234-1234-123456789abc.jpg']);
  });
});
