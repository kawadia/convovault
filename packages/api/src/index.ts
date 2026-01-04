import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Types for Cloudflare Workers environment
export interface Env {
  DB: D1Database;
  ADMIN_API_KEY: string;
  ENVIRONMENT: string;
}

// Create Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use(
  '*',
  cors({
    origin: '*', // Configure properly for production
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-User-ID', 'X-Admin-Key'],
  })
);

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'convovault-api' });
});

// API v1 routes will be added here
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', version: '1.0.0' });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
