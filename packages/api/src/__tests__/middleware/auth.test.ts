import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { adminAuth, userAuth } from '../../middleware/auth';

// Mock environment
const mockEnv = {
  ADMIN_API_KEY: 'test-admin-key-12345',
  DB: {} as D1Database,
  ENVIRONMENT: 'test',
};

describe('adminAuth middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('/admin/*', adminAuth);
    app.post('/admin/import', (c) => c.json({ success: true }));
    app.delete('/admin/chat/:id', (c) => c.json({ deleted: true }));
  });

  it('rejects request without X-Admin-Key header', async () => {
    const res = await app.request('/admin/import', {
      method: 'POST',
    }, mockEnv);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'Admin authentication required' });
  });

  it('rejects request with invalid admin key', async () => {
    const res = await app.request('/admin/import', {
      method: 'POST',
      headers: {
        'X-Admin-Key': 'wrong-key',
      },
    }, mockEnv);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'Invalid admin key' });
  });

  it('allows request with valid admin key', async () => {
    const res = await app.request('/admin/import', {
      method: 'POST',
      headers: {
        'X-Admin-Key': 'test-admin-key-12345',
      },
    }, mockEnv);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });

  it('works for different admin routes', async () => {
    const res = await app.request('/admin/chat/123', {
      method: 'DELETE',
      headers: {
        'X-Admin-Key': 'test-admin-key-12345',
      },
    }, mockEnv);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ deleted: true });
  });
});

describe('userAuth middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('/user/*', userAuth);
    app.get('/user/chats', (c) => {
      const userId = c.get('userId');
      return c.json({ userId, chats: [] });
    });
    app.patch('/user/chats/:id', (c) => {
      const userId = c.get('userId');
      return c.json({ userId, updated: true });
    });
  });

  it('accepts request with valid X-User-ID header', async () => {
    const res = await app.request('/user/chats', {
      method: 'GET',
      headers: {
        'X-User-ID': 'user-abc-123',
      },
    }, mockEnv);

    expect(res.status).toBe(200);
    const json = await res.json() as { userId: string };
    expect(json.userId).toBe('user-abc-123');
  });

  it('generates user ID if X-User-ID header is missing', async () => {
    const res = await app.request('/user/chats', {
      method: 'GET',
    }, mockEnv);

    expect(res.status).toBe(200);
    const json = await res.json() as { userId: string };
    expect(json.userId).toBeTruthy();
    expect(typeof json.userId).toBe('string');
  });

  it('generates UUID-like user ID', async () => {
    const res = await app.request('/user/chats', {
      method: 'GET',
    }, mockEnv);

    expect(res.status).toBe(200);
    const json = await res.json() as { userId: string };
    // Should be a UUID-like format (contains hyphens, alphanumeric)
    expect(json.userId).toMatch(/^[a-f0-9-]+$/i);
  });

  it('sets userId in context for downstream handlers', async () => {
    const res = await app.request('/user/chats/123', {
      method: 'PATCH',
      headers: {
        'X-User-ID': 'my-user-id',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ readPosition: 5 }),
    }, mockEnv);

    expect(res.status).toBe(200);
    const json = await res.json() as { userId: string };
    expect(json.userId).toBe('my-user-id');
  });

  it('returns generated user ID in response header', async () => {
    const res = await app.request('/user/chats', {
      method: 'GET',
    }, mockEnv);

    expect(res.status).toBe(200);
    // Check if the generated user ID is returned in a header
    const newUserId = res.headers.get('X-User-ID');
    expect(newUserId).toBeTruthy();
  });

  it('does not overwrite existing user ID in response header', async () => {
    const res = await app.request('/user/chats', {
      method: 'GET',
      headers: {
        'X-User-ID': 'existing-user-id',
      },
    }, mockEnv);

    expect(res.status).toBe(200);
    // Should return the same user ID
    const returnedUserId = res.headers.get('X-User-ID');
    expect(returnedUserId).toBe('existing-user-id');
  });
});
