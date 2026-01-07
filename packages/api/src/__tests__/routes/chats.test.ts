import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { chatsRoutes } from '../../routes/chats';

// Mock the fetch function for testing URL imports
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock D1 Database with session support
const createMockDb = (sessionUser: { id: string; role: string } | null = null) => {
  const storage = new Map<string, unknown>();
  const statements: Array<{
    sql: string;
    bindings: unknown[];
  }> = [];

  return {
    prepare: (sql: string) => {
      const exec = (...bindings: unknown[]) => ({
        run: async () => {
          statements.push({ sql, bindings });
          return { success: true, meta: {} };
        },
        first: async () => {
          statements.push({ sql, bindings });
          // Return user from session lookup
          if (sql.includes('sessions') && sql.includes('users')) {
            return sessionUser;
          }
          // Return mock data based on query
          if (sql.includes('SELECT') && sql.includes('chats')) {
            // Try to find the chat ID in any of the bindings
            for (const binding of bindings) {
              if (typeof binding === 'string' && storage.has(`chat:${binding}`)) {
                const chat = storage.get(`chat:${binding}`) as any;
                return { ...chat, is_favorite: storage.get(`fav:${binding}`) ? 1 : 0 };
              }
            }
          }
          return null;
        },
        all: async () => {
          statements.push({ sql, bindings });
          if (sql.includes('SELECT') && sql.includes('chats') && !sql.includes('SUM(is_favorite)')) {
            const results = Array.from(storage.entries())
              .filter(([key]) => key.startsWith('chat:'))
              .map(([key, value]: [string, any]) => {
                const id = key.replace('chat:', '');
                return { ...value, is_favorite: storage.get(`fav:${id}`) ? 1 : 0 };
              });
            return { results };
          }
          if (sql.includes('user_chats') && sql.includes('SUM(is_favorite)')) {
            // Mock social counts aggregation
            const countsMap = new Map<string, number>();
            Array.from(storage.entries())
              .filter(([key]) => key.startsWith('fav:'))
              .forEach(([key, value]) => {
                const id = key.replace('fav:', '');
                if (value) {
                  countsMap.set(id, (countsMap.get(id) || 0) + 1);
                }
              });
            const results = Array.from(countsMap.entries()).map(([chat_id, favorite_count]) => ({
              chat_id,
              favorite_count,
            }));
            return { results };
          }
          return { results: [] };
        },
      });

      const stmt = exec();
      return {
        ...stmt,
        bind: (...bindings: unknown[]) => exec(...bindings),
      };
    },
    // Helper for tests to set up data
    _setChat: (id: string, data: unknown) => storage.set(`chat:${id}`, data),
    _setFavorite: (id: string, isFav: boolean) => storage.set(`fav:${id}`, isFav),
    _getStatements: () => statements,
    _clear: () => {
      storage.clear();
      statements.length = 0;
    },
  };
};

// Mock environment
const createMockEnv = (sessionUser: { id: string; role: string } | null = null) => ({
  ADMIN_API_KEY: 'test-admin-key',
  DB: createMockDb(sessionUser) as unknown as D1Database,
  ENVIRONMENT: 'test',
  CF_ACCOUNT_ID: 'test-account-id',
  CF_API_TOKEN: 'test-api-token',
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

const mockAdminUser = { id: 'admin-user-123', role: 'admin' };
const mockRegularUser = { id: 'regular-user-456', role: 'user' };

describe('chatsRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/v1', chatsRoutes);
    mockFetch.mockReset();
  });

  describe('POST /api/v1/chats/import', () => {
    it('returns 401 without session', async () => {
      const mockEnv = createMockEnv(null);
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://claude.ai/share/abc123' }),
      }, mockEnv);

      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid URL format', async () => {
      const mockEnv = createMockEnv(mockRegularUser);
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=test-session',
        },
        body: JSON.stringify({ url: 'not-a-url' }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toHaveProperty('error');
    });

    it('returns 400 for non-claude.ai URL', async () => {
      const mockEnv = createMockEnv(mockRegularUser);
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=test-session',
        },
        body: JSON.stringify({ url: 'https://google.com/share/abc' }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Unsupported');
    });

    it('uses browser rendering when no HTML is provided', async () => {
      // Mock Browser Rendering API response (returns JSON with HTML in result field)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, result: mockChatHtml }),
      });

      const mockEnv = createMockEnv(mockRegularUser);
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=test-session',
        },
        body: JSON.stringify({ url: 'https://claude.ai/share/abc123' }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title', 'Test Chat');
      expect(json).toHaveProperty('source', 'claude-web');

      // Verify browser rendering API was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/browser-rendering/content',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-token',
          }),
        })
      );
    });

    it('uses provided HTML when available (skips browser rendering)', async () => {
      const mockEnv = createMockEnv(mockRegularUser);
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=test-session',
        },
        body: JSON.stringify({
          url: 'https://claude.ai/share/abc123',
          html: mockChatHtml,
        }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title', 'Test Chat');
      expect(json).toHaveProperty('source', 'claude-web');

      // Verify browser rendering API was NOT called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const mockEnv = createMockEnv(mockRegularUser);
      const res = await app.request('/api/v1/chats/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=test-session',
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
      const mockEnv = createMockEnv(null);
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
      const mockEnv = createMockEnv(null);
      const res = await app.request('/api/v1/chats/unknown-id', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toEqual({ error: 'Chat not found' });
    });
  });

  describe('DELETE /api/v1/chats/:id', () => {
    it('returns 401 without session', async () => {
      const mockEnv = createMockEnv(null);
      const res = await app.request('/api/v1/chats/test-id', {
        method: 'DELETE',
      }, mockEnv);

      expect(res.status).toBe(401);
    });

    it('allows admin to delete any chat', async () => {
      // Create mock DB with admin user and set up a chat owned by another user
      const mockDb = createMockDb(mockAdminUser);
      mockDb._setChat('other-user-chat', {
        id: 'other-user-chat',
        user_id: 'different-user-id',
        source: 'claude-web',
        source_url: 'https://claude.ai/share/abc123',
        title: 'Other User Chat',
        fetched_at: Date.now(),
        message_count: 1,
        word_count: 10,
        content: '{}',
      });

      const mockEnv = {
        ADMIN_API_KEY: 'test-admin-key',
        DB: mockDb as unknown as D1Database,
        ENVIRONMENT: 'test',
        CF_ACCOUNT_ID: 'test-account-id',
        CF_API_TOKEN: 'test-api-token',
      };

      const res = await app.request('/api/v1/chats/other-user-chat', {
        method: 'DELETE',
        headers: {
          'Cookie': 'session=admin-session',
        },
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ deleted: true });
    });

    it('allows user to delete their own chat', async () => {
      // Create a mock DB that returns the user as owner of the chat
      const mockDb = createMockDb(mockRegularUser);
      mockDb._setChat('user-owned-chat', {
        id: 'user-owned-chat',
        user_id: mockRegularUser.id,
        source: 'claude-web',
        source_url: 'https://claude.ai/share/abc123',
        title: 'User Chat',
        fetched_at: Date.now(),
        message_count: 1,
        word_count: 10,
        content: '{}',
      });

      const mockEnv = {
        ADMIN_API_KEY: 'test-admin-key',
        DB: mockDb as unknown as D1Database,
        ENVIRONMENT: 'test',
        CF_ACCOUNT_ID: 'test-account-id',
        CF_API_TOKEN: 'test-api-token',
      };

      const res = await app.request('/api/v1/chats/user-owned-chat', {
        method: 'DELETE',
        headers: {
          'Cookie': 'session=user-session',
        },
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ deleted: true });
    });
  });

  describe('Favoriting Functionality', () => {
    it('returns 401 when favoriting without session', async () => {
      const mockEnv = createMockEnv(null);
      const res = await app.request('/api/v1/chats/test-chat-id/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: true }),
      }, mockEnv);

      expect(res.status).toBe(401);
    });

    it('toggles favorite status for logged-in user', async () => {
      const mockEnv = createMockEnv(mockRegularUser);
      const res = await app.request('/api/v1/chats/test-chat-id/favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=test-session',
        },
        body: JSON.stringify({ favorite: true }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ favorite: true });

      // Verify DB was called (either INSERT or UPDATE)
      const statements = (mockEnv.DB as any)._getStatements();
      const favStatement = statements.find((s: any) => s.sql.includes('user_chats') && (s.sql.includes('INSERT') || s.sql.includes('UPDATE')));
      expect(favStatement).toBeDefined();
    });

    it('returns isFavorite in list results', async () => {
      const mockEnv = createMockEnv(mockRegularUser);
      const db = (mockEnv.DB as any);
      db._setChat('test-chat-id', {
        id: 'test-chat-id',
        source: 'claude-web',
        source_url: 'https://claude.ai/share/abc123',
        title: 'Test Chat',
        fetched_at: Date.now(),
        content: '{}',
      });
      db._setFavorite('test-chat-id', true);

      const res = await app.request('/api/v1/chats', {
        method: 'GET',
        headers: { 'Cookie': 'session=test-session' },
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.chats[0]).toHaveProperty('isFavorite', true);
    });
  });

  describe('GET /api/v1/chats/social-counts', () => {
    it('returns empty counts when no favorites exist', async () => {
      const mockEnv = createMockEnv(null);
      const res = await app.request('/api/v1/chats/social-counts', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ counts: {} });
    });

    it('returns aggregated counts for favorited chats', async () => {
      const mockEnv = createMockEnv(null);
      const db = (mockEnv.DB as any);

      // Simulate multiple users favoriting same/different chats
      db._setFavorite('chat-1', true);
      db._setFavorite('chat-2', true);

      const res = await app.request('/api/v1/chats/social-counts', {
        method: 'GET',
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.counts).toEqual({
        'chat-1': 1,
        'chat-2': 1,
      });
    });
  });
});
