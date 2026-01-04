import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

// Extend Hono's Variables type to include userId
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

/**
 * Admin authentication middleware
 *
 * Requires a valid X-Admin-Key header matching the ADMIN_API_KEY environment variable.
 * Use this for sensitive operations like importing and deleting chats.
 */
export const adminAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const adminKey = c.req.header('X-Admin-Key');

    if (!adminKey) {
      return c.json({ error: 'Admin authentication required' }, 401);
    }

    const expectedKey = c.env.ADMIN_API_KEY;

    if (adminKey !== expectedKey) {
      return c.json({ error: 'Invalid admin key' }, 401);
    }

    await next();
  }
);

/**
 * User authentication middleware
 *
 * Reads the X-User-ID header to identify the user.
 * If no user ID is provided, generates a new one.
 * The user ID is set in the context for downstream handlers.
 * The user ID is also returned in the response X-User-ID header.
 */
export const userAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    let userId = c.req.header('X-User-ID');

    // Generate a new user ID if not provided
    if (!userId) {
      userId = generateUserId();
    }

    // Set user ID in context for downstream handlers
    c.set('userId', userId);

    // Continue to next handler
    await next();

    // Set the user ID in response header
    // This allows the client to persist it for future requests
    c.header('X-User-ID', userId);
  }
);

/**
 * Generate a UUID-like user ID
 */
function generateUserId(): string {
  // Use crypto.randomUUID() if available (modern environments)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: generate a simple UUID-like string
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  const parts: string[] = [];

  for (const length of segments) {
    let segment = '';
    for (let i = 0; i < length; i++) {
      segment += hex[Math.floor(Math.random() * 16)];
    }
    parts.push(segment);
  }

  return parts.join('-');
}
