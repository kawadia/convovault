import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { chatsRoutes } from '../../routes/chats';

// Mock the fetch function for testing URL imports
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock D1 Database
const createMockDb = () => {
  const storage = new Map<string, unknown>();
  const statements: Array<{
    sql: string;
    bindings: unknown[];
  }> = [];

  return {
    prepare: (sql: string) => ({
      bind: (...bindings: unknown[]) => ({
        run: async () => {
          statements.push({ sql, bindings });
          return { success: true, meta: {} };
        },
        first: async () => {
          statements.push({ sql, bindings });
          // Return mock data based on query
          if (sql.includes('SELECT') && sql.includes('chats')) {
            const id = bindings[0] as string;
            return storage.get(`chat:${id}`) || null;
          }
          return null;
        },
        all: async () => {
          statements.push({ sql, bindings });
          return { results: [] };
        },
      }),
    }),
    // Helper for tests to set up data
    _setChat: (id: string, data: unknown) => storage.set(`chat:${id}`, data),
    _getStatements: () => statements,
    _clear: () => {
      storage.clear();
      statements.length = 0;
    },
  };
};

// Mock environment
const createMockEnv = () => ({
  ADMIN_API_KEY: 'test-admin-key',
  DB: createMockDb() as unknown as D1Database,
  ENVIRONMENT: 'test',
});

// Sample HTML for mock responses
const mockChatHtml = `
<!DOCTYPE html>
<html>
<head><title>Test Chat | Claude</title></head>
<body>
  <div data-test-render-count="2">
    <div class="mb-1 mt-6 group">
      <div class="flex flex-col items-end gap-1">
        <div class="flex flex-row gap-2 relative">
          <div class="flex-1">
            <div class="font-large !font-user-message">Hello Claude</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div data-test-render-count="2">
    <div class="group">
      <div class="group relative pb-3" data-is-streaming="false">
        <p>Hello! How can I help you today?</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

describe('chatsRoutes', () => {
  let app: Hono;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockEnv = createMockEnv();
    app = new Hono();
    app.route('/api/v1', chatsRoutes);
    mockFetch.mockReset();
  });

  describe('POST /api/v1/chats/import', () => {
    it('returns 401 without admin key', async () => {
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://claude.ai/share/abc123' }),
      }, mockEnv);

      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid URL format', async () => {
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'test-admin-key',
        },
        body: JSON.stringify({ url: 'not-a-url' }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toHaveProperty('error');
    });

    it('returns 400 for non-claude.ai URL', async () => {
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'test-admin-key',
        },
        body: JSON.stringify({ url: 'https://google.com/share/abc' }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Unsupported');
    });

    it('successfully imports a valid claude.ai share URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockChatHtml),
      });

      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'test-admin-key',
        },
        body: JSON.stringify({ url: 'https://claude.ai/share/abc123' }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title', 'Test Chat');
      expect(json).toHaveProperty('source', 'claude-web');
    });

    it('returns cached chat if already imported', async () => {
      // Set up existing chat in mock DB
      const existingChat = {
        id: 'existing-id',
        source: 'claude-web',
        source_url: 'https://claude.ai/share/abc123',
        title: 'Existing Chat',
        fetched_at: Date.now(),
        message_count: 2,
        word_count: 10,
        content: '{}',
      };
      (mockEnv.DB as unknown as ReturnType<typeof createMockDb>)._setChat(
        'existing-id',
        existingChat
      );

      // Mock the URL lookup to find existing
      const db = mockEnv.DB as unknown as ReturnType<typeof createMockDb>;
      const originalPrepare = db.prepare;
      db.prepare = (sql: string) => {
        if (sql.includes('source_url')) {
          return {
            bind: () => ({
              first: async () => existingChat,
              run: async () => ({ success: true, meta: {} }),
              all: async () => ({ results: [] }),
            }),
          };
        }
        return originalPrepare(sql);
      };

      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'test-admin-key',
        },
        body: JSON.stringify({ url: 'https://claude.ai/share/abc123' }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('cached', true);
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'test-admin-key',
        },
        body: JSON.stringify({ url: 'https://claude.ai/share/abc123' }),
      }, mockEnv);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/chats/:id', () => {
    it('returns chat transcript (no auth required)', async () => {
      const mockChat = {
        id: 'test-chat-id',
        source: 'claude-web',
        source_url: 'https://claude.ai/share/abc123',
        title: 'Test Chat',
        fetched_at: Date.now(),
        message_count: 2,
        word_count: 20,
        content: JSON.stringify({
          messages: [
            { id: 'msg-0', index: 0, role: 'user', content: [{ type: 'text', content: 'Hello' }] },
            { id: 'msg-1', index: 1, role: 'assistant', content: [{ type: 'text', content: 'Hi!' }] },
          ],
        }),
      };

      (mockEnv.DB as unknown as ReturnType<typeof createMockDb>)._setChat(
        'test-chat-id',
        mockChat
      );

      const res = await app.request('/api/v1/chats/test-chat-id', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('id', 'test-chat-id');
      expect(json).toHaveProperty('title', 'Test Chat');
    });

    it('returns 404 for unknown chat', async () => {
      const res = await app.request('/api/v1/chats/unknown-id', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toEqual({ error: 'Chat not found' });
    });
  });

  describe('DELETE /api/v1/chats/:id', () => {
    it('returns 401 without admin key', async () => {
      const res = await app.request('/api/v1/chats/test-id', {
        method: 'DELETE',
      }, mockEnv);

      expect(res.status).toBe(401);
    });

    it('successfully deletes chat with admin key', async () => {
      const res = await app.request('/api/v1/chats/test-id', {
        method: 'DELETE',
        headers: {
          'X-Admin-Key': 'test-admin-key',
        },
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ deleted: true });
    });
  });
});
