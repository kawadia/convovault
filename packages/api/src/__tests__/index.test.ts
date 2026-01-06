import { describe, it, expect } from 'vitest';
import app from '../index';

describe('API Health Check', () => {
  it('returns ok status on root', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: 'ok', service: 'diastack-api' });
  });

  it('returns ok status on /api/v1/health', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: 'ok', version: '1.0.0' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/unknown');
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: 'Not Found' });
  });
});
