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
      if (key === 'SIMILARITY_THRESHOLD') return '0.55';
      return 'test-key';
    })
  }
} as any;

// 2. Mock Supabase Client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn(),
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
  single: vi.fn(),
  insert: vi.fn(() => mockSupabaseClient),
  storage: {
    from: vi.fn(() => mockSupabaseClient),
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    remove: vi.fn(),
  }
};

const createClientMock = vi.fn(() => mockSupabaseClient);

// 3. Extract and load the handler from the Deno file
const filePath = path.resolve(__dirname, '../../../supabase/functions/match-face/index.ts');
let code = fs.readFileSync(filePath, 'utf-8');

// Strip out imports
code = code.replace(/import .*;/g, '');

// Capture the handler passed to `serve`
let handler: (req: Request) => Promise<Response>;
const serveMock = (fn: any) => { handler = fn; };

// Evaluate the code in this context
const evalContext = new Function('serve', 'createClient', 'Deno', 'fetch', 'FormData', 'File', code);
evalContext(serveMock, createClientMock, global.Deno, global.fetch, FormData, File);

describe('match-face Edge Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: '123' } }, error: null });
    mockSupabaseClient.rpc.mockResolvedValue({ data: [{ id: 'photo1' }], error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] })
    } as any);
  });

  it('rejects requests without session', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await handler(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Missing Authorization header');
  });

  it('arms fetch to Railway with correct headers', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token' }
    });
    req.formData = async () => formData;

    await handler(req);

    expect(mockFetch).toHaveBeenCalledWith('http://railway.test/compare', expect.objectContaining({
      method: 'POST',
      headers: { 'X-Service-Secret': 'secret' }
    }));
  });

  it('does not persist embedding and invokes RPC correctly', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token' }
    });
    req.formData = async () => formData;

    const res = await handler(req);
    expect(res.status).toBe(200);

    // RPC was called
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('match_event_photos', {
      query_embedding: '[0.1,0.2,0.3]',
      match_threshold: 0.55,
      match_count: 50
    });

    // Ensure insert was NEVER called
    expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    expect(mockSupabaseClient.storage.upload).not.toHaveBeenCalled();
  });
});
