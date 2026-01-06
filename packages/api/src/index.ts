import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chatsRoutes } from './routes/chats';
import { authRoutes } from './routes/auth';

// Types for Cloudflare Workers environment
export interface Env {
  DB: D1Database;
  ADMIN_API_KEY: string;
  ENVIRONMENT: string;
  // Cloudflare Browser Rendering API credentials
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  // Google OAuth credentials
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_REDIRECT_URI: string;
  FRONTEND_URL: string;
}

// Create Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

// CORS middleware - dynamic origin for cookies
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests from these origins (needed for cookies)
      const allowedOrigins = [
        'http://localhost:5173',
        'https://diastack.pages.dev',
      ];
      // Also allow any *.diastack.pages.dev preview URLs
      if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.diastack.pages.dev'))) {
        return origin;
      }
      return allowedOrigins[0]; // Default for non-browser requests
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-User-ID'],
    exposeHeaders: ['X-User-ID'],
    credentials: true, // Allow cookies
  })
);

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'diastack-api' });
});

// API v1 routes
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', version: '1.0.0' });
});

// Mount routes
app.route('/api/v1', chatsRoutes);
app.route('/api/v1', authRoutes);

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
