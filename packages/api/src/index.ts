import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chatsRoutes } from './routes/chats';

// Types for Cloudflare Workers environment
export interface Env {
  DB: D1Database;
  ADMIN_API_KEY: string;
  ENVIRONMENT: string;
  // Cloudflare Browser Rendering API credentials
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
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
    exposeHeaders: ['X-User-ID'],
  })
);

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'convovault-api' });
});

// API v1 routes
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', version: '1.0.0' });
});

// Mount chat routes
app.route('/api/v1', chatsRoutes);

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
