import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../index';

// Hardcoded admin email
const ADMIN_EMAIL = 'kawadia@gmail.com';

// Session duration: 30 days in seconds
const SESSION_DURATION = 30 * 24 * 60 * 60;

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * Redirect to Google OAuth consent screen
 */
authRoutes.get('/auth/google', async (c) => {
  const state = crypto.randomUUID();

  // Store state in a short-lived cookie for CSRF protection
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.AUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

/**
 * Handle Google OAuth callback
 */
authRoutes.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const storedState = getCookie(c, 'oauth_state');

  // Clear the state cookie
  deleteCookie(c, 'oauth_state', { path: '/' });

  // Handle errors from Google
  if (error) {
    console.error('OAuth error:', error);
    return c.redirect(`${c.env.FRONTEND_URL}?error=oauth_denied`);
  }

  // Validate state for CSRF protection
  if (!state || state !== storedState) {
    console.error('State mismatch:', { state, storedState });
    return c.redirect(`${c.env.FRONTEND_URL}?error=invalid_state`);
  }

  if (!code) {
    return c.redirect(`${c.env.FRONTEND_URL}?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: c.env.AUTH_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return c.redirect(`${c.env.FRONTEND_URL}?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    // Get user info from Google
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info');
      return c.redirect(`${c.env.FRONTEND_URL}?error=userinfo_failed`);
    }

    const googleUser = await userInfoResponse.json() as GoogleUserInfo;

    // Create or update user in database
    const userId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Check if user exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE google_id = ?'
    ).bind(googleUser.id).first<{ id: string; role: string }>();

    let finalUserId: string;
    let userRole: string;

    if (existingUser) {
      // Update existing user
      finalUserId = existingUser.id;
      userRole = existingUser.role;

      await c.env.DB.prepare(
        'UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?'
      ).bind(googleUser.email, googleUser.name, googleUser.picture, finalUserId).run();
    } else {
      // Create new user
      finalUserId = userId;
      // Set role to admin if email matches hardcoded admin
      userRole = googleUser.email === ADMIN_EMAIL ? 'admin' : 'user';

      await c.env.DB.prepare(
        'INSERT INTO users (id, google_id, email, name, picture, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(finalUserId, googleUser.id, googleUser.email, googleUser.name, googleUser.picture, userRole, now).run();
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = now + SESSION_DURATION;

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).bind(sessionId, finalUserId, expiresAt, now).run();

    // Set session cookie
    setCookie(c, 'session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: SESSION_DURATION,
      path: '/',
    });

    // Redirect to frontend
    return c.redirect(c.env.FRONTEND_URL);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return c.redirect(`${c.env.FRONTEND_URL}?error=callback_failed`);
  }
});

/**
 * Get current user from session
 */
authRoutes.get('/auth/me', async (c) => {
  const sessionId = getCookie(c, 'session');

  if (!sessionId) {
    return c.json({ user: null });
  }

  const now = Math.floor(Date.now() / 1000);

  // Get session and user
  const result = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.picture, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).bind(sessionId, now).first<{
    id: string;
    email: string;
    name: string;
    picture: string;
    role: string;
  }>();

  if (!result) {
    // Invalid or expired session - clear cookie
    deleteCookie(c, 'session', { path: '/' });
    return c.json({ user: null });
  }

  return c.json({
    user: {
      id: result.id,
      email: result.email,
      name: result.name,
      picture: result.picture,
      role: result.role,
    },
  });
});

/**
 * Logout - clear session
 */
authRoutes.post('/auth/logout', async (c) => {
  const sessionId = getCookie(c, 'session');

  if (sessionId) {
    // Delete session from database
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();

    // Clear cookie
    deleteCookie(c, 'session', { path: '/' });
  }

  return c.json({ success: true });
});

/**
 * List all users (admin only)
 */
authRoutes.get('/auth/users', async (c) => {
  const sessionId = getCookie(c, 'session');

  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const now = Math.floor(Date.now() / 1000);

  // Check if user is admin
  const session = await c.env.DB.prepare(`
    SELECT u.role FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).bind(sessionId, now).first<{ role: string }>();

  if (!session || session.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Get all users
  const users = await c.env.DB.prepare(
    'SELECT id, email, name, picture, role, created_at FROM users ORDER BY created_at DESC'
  ).all();

  return c.json({ users: users.results });
});

/**
 * Update user role (admin only)
 */
authRoutes.patch('/auth/users/:id/role', async (c) => {
  const sessionId = getCookie(c, 'session');
  const targetUserId = c.req.param('id');

  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const now = Math.floor(Date.now() / 1000);

  // Check if user is admin
  const session = await c.env.DB.prepare(`
    SELECT u.id, u.role, u.email FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).bind(sessionId, now).first<{ id: string; role: string; email: string }>();

  if (!session || session.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Prevent admin from removing their own admin role
  if (targetUserId === session.id) {
    return c.json({ error: 'Cannot modify your own role' }, 400);
  }

  const body = await c.req.json<{ role: string }>();

  if (!body.role || !['user', 'admin'].includes(body.role)) {
    return c.json({ error: 'Invalid role. Must be "user" or "admin"' }, 400);
  }

  // Update user role
  await c.env.DB.prepare(
    'UPDATE users SET role = ? WHERE id = ?'
  ).bind(body.role, targetUserId).run();

  return c.json({ success: true });
});
