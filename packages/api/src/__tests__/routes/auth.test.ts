import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from '../../routes/auth';

// Mock D1 database
const createMockDB = () => {
  const mockPrepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
    }),
  });

  return {
    prepare: mockPrepare,
  } as unknown as D1Database;
};

// Mock environment
const createMockEnv = (overrides = {}) => ({
  DB: createMockDB(),
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  AUTH_REDIRECT_URI: 'https://api.example.com/api/v1/auth/callback',
  FRONTEND_URL: 'https://example.com',
  ...overrides,
});

describe('Auth Routes', () => {
  describe('GET /auth/google', () => {
    it('redirects to Google OAuth with correct parameters', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/google', {
        method: 'GET',
      }, createMockEnv());

      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toContain('accounts.google.com');
      expect(location).toContain('client_id=test-client-id');
      expect(location).toContain('redirect_uri=');
      expect(location).toContain('scope=openid+email+profile');
    });

    it('sets oauth_state cookie', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/google', {
        method: 'GET',
      }, createMockEnv());

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('oauth_state=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('SameSite=None');
    });
  });

  describe('GET /auth/callback', () => {
    it('redirects to frontend with error if OAuth error', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/callback?error=access_denied', {
        method: 'GET',
      }, createMockEnv());

      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toBe('https://example.com?error=oauth_denied');
    });

    it('redirects to frontend with error if state mismatch', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/callback?code=test&state=wrong', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=correct',
        },
      }, createMockEnv());

      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toBe('https://example.com?error=invalid_state');
    });

    it('redirects to frontend with error if no code', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/callback?state=test', {
        method: 'GET',
        headers: {
          Cookie: 'oauth_state=test',
        },
      }, createMockEnv());

      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toBe('https://example.com?error=no_code');
    });
  });

  describe('GET /auth/me', () => {
    it('returns null user when no session cookie', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/me', {
        method: 'GET',
      }, createMockEnv());

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ user: null });
    });

    it('returns null user when session is invalid', async () => {
      const mockDB = createMockDB();
      (mockDB.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null), // Session not found
        }),
      });

      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          Cookie: 'session=invalid-session-id',
        },
      }, createMockEnv({ DB: mockDB }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ user: null });
    });

    it('returns user when session is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        role: 'user',
      };

      const mockDB = createMockDB();
      (mockDB.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUser),
        }),
      });

      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          Cookie: 'session=valid-session-id',
        },
      }, createMockEnv({ DB: mockDB }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ user: mockUser });
    });
  });

  describe('POST /auth/logout', () => {
    it('deletes session from database', async () => {
      const mockDB = createMockDB();
      const mockRun = vi.fn().mockResolvedValue({});
      (mockDB.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: mockRun,
        }),
      });

      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: 'session=test-session-id',
        },
      }, createMockEnv({ DB: mockDB }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
      expect(mockRun).toHaveBeenCalled();
    });

    it('clears session cookie', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: 'session=test-session-id',
        },
      }, createMockEnv());

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('session=');
      // Cookie should be cleared (empty or expired)
    });

    it('succeeds even without session', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/logout', {
        method: 'POST',
      }, createMockEnv());

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
    });
  });

  describe('GET /auth/users (admin only)', () => {
    it('returns 401 when not authenticated', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/users', {
        method: 'GET',
      }, createMockEnv());

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: 'Authentication required' });
    });

    it('returns 403 when not admin', async () => {
      const mockDB = createMockDB();
      (mockDB.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ role: 'user' }),
        }),
      });

      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/users', {
        method: 'GET',
        headers: {
          Cookie: 'session=user-session',
        },
      }, createMockEnv({ DB: mockDB }));

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toEqual({ error: 'Admin access required' });
    });
  });

  describe('PATCH /auth/users/:id/role (admin only)', () => {
    it('returns 401 when not authenticated', async () => {
      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/users/user-123/role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'admin' }),
      }, createMockEnv());

      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid role', async () => {
      const mockDB = createMockDB();
      (mockDB.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 'admin-123', role: 'admin', email: 'admin@example.com' }),
          run: vi.fn().mockResolvedValue({}),
        }),
      });

      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/users/user-123/role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'session=admin-session',
        },
        body: JSON.stringify({ role: 'superadmin' }),
      }, createMockEnv({ DB: mockDB }));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid role');
    });

    it('prevents admin from changing own role', async () => {
      const mockDB = createMockDB();
      (mockDB.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 'admin-123', role: 'admin', email: 'admin@example.com' }),
        }),
      });

      const app = new Hono();
      app.route('/api/v1', authRoutes);

      const res = await app.request('/api/v1/auth/users/admin-123/role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'session=admin-session',
        },
        body: JSON.stringify({ role: 'user' }),
      }, createMockEnv({ DB: mockDB }));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Cannot modify your own role');
    });
  });
});
