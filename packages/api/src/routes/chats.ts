import { Hono } from 'hono';
import { ImportChatRequestSchema } from '@convovault/shared';
import { z } from 'zod';
import type { Env } from '../index';
import { adminAuth } from '../middleware/auth';
import { claudeWebParser } from '../parsers/claude-web';

export const chatsRoutes = new Hono<{ Bindings: Env }>();

// List of supported parsers
const parsers = [claudeWebParser];

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch rendered HTML using Cloudflare Browser Rendering REST API
 * This bypasses Cloudflare's bot protection and waits for React to hydrate
 * Includes retry logic with exponential backoff for rate limits
 */
async function fetchRenderedHtml(url: string, env: Env): Promise<string> {
  const maxRetries = 3;
  const baseDelay = 2000; // 2 seconds

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/content`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          // Wait for the page to be fully loaded and idle
          gotoOptions: { waitUntil: 'networkidle0' },
          // Wait for Claude's message container to appear (indicates React hydration complete)
          waitForSelector: {
            selector: '[data-is-streaming]',
            options: { timeout: 15000 },
          },
        }),
      }
    );

    // Handle rate limiting with retry
    if (response.status === 429) {
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 2s, 4s, 8s
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      throw new Error('Browser rendering rate limit exceeded after retries');
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Browser rendering failed: ${response.status} - ${errorBody}`);
    }

    // The API returns JSON: { success: boolean, result: string (HTML) }
    const json = await response.json() as { success: boolean; result: string };

    if (!json.success || !json.result) {
      throw new Error('Browser rendering returned empty result');
    }

    return json.result;
  }

  throw new Error('Browser rendering failed after all retries');
}

// Extended schema for import with optional HTML content
const ImportWithHtmlSchema = z.object({
  url: z.string().url(),
  html: z.string().optional(), // Pre-rendered HTML from browser
});

/**
 * POST /chats/import
 * Import a chat from a URL (admin only)
 *
 * If `html` is provided in the body, it will be used directly.
 * Otherwise, the URL will be fetched (note: RSC pages may not parse correctly).
 */
chatsRoutes.post('/chats/import', adminAuth, async (c) => {
  // Parse and validate request body
  const body = await c.req.json();
  const parseResult = ImportWithHtmlSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Invalid request', details: parseResult.error.issues },
      400
    );
  }

  const { url, html: providedHtml } = parseResult.data;

  // Find a parser that can handle this URL
  const parser = parsers.find((p) => p.canParse(url));
  if (!parser) {
    return c.json(
      { error: 'Unsupported URL. Only claude.ai share links are supported.' },
      400
    );
  }

  // Check if already imported
  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM chats WHERE source_url = ?'
    )
      .bind(url)
      .first();

    if (existing) {
      return c.json({
        ...formatChatResponse(existing),
        cached: true,
      });
    }
  } catch {
    // Table might not exist yet, continue with import
  }

  // Use provided HTML or fetch using browser rendering
  let html: string;

  if (providedHtml) {
    // Use pre-rendered HTML from browser (file upload flow)
    html = providedHtml;
  } else {
    // Use Cloudflare Browser Rendering to fetch the page
    // This bypasses Cloudflare's bot protection and waits for React hydration
    try {
      html = await fetchRenderedHtml(url, c.env);
    } catch (error) {
      console.error('Browser rendering error:', error);
      return c.json(
        {
          error: 'Failed to fetch page',
          details: error instanceof Error ? error.message : 'Unknown error',
          hint: 'Ensure CF_ACCOUNT_ID and CF_API_TOKEN are configured correctly'
        },
        500
      );
    }
  }

  // Parse the HTML
  const transcript = parser.parse(html, url);

  // Store in database
  try {
    await c.env.DB.prepare(
      `INSERT INTO chats (id, source, source_url, title, created_at, fetched_at, message_count, word_count, content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        transcript.id,
        transcript.source,
        transcript.sourceUrl,
        transcript.title,
        transcript.createdAt || null,
        transcript.fetchedAt,
        transcript.messageCount,
        transcript.wordCount,
        JSON.stringify(transcript)
      )
      .run();
  } catch (error) {
    console.error('Failed to store chat:', error);
    // Still return the parsed transcript even if storage fails
  }

  return c.json({
    id: transcript.id,
    source: transcript.source,
    sourceUrl: transcript.sourceUrl,
    title: transcript.title,
    messageCount: transcript.messageCount,
    wordCount: transcript.wordCount,
    fetchedAt: transcript.fetchedAt,
  });
});

/**
 * GET /chats
 * List all chats (public)
 */
chatsRoutes.get('/chats', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT id, source, source_url, title, created_at, fetched_at, message_count, word_count FROM chats ORDER BY fetched_at DESC'
    ).all();

    const chats = (result.results || []).map((row) => ({
      id: row.id,
      source: row.source,
      sourceUrl: row.source_url,
      title: row.title,
      createdAt: row.created_at,
      fetchedAt: row.fetched_at,
      messageCount: row.message_count,
      wordCount: row.word_count,
    }));

    return c.json({ chats });
  } catch {
    return c.json({ chats: [] });
  }
});

/**
 * GET /chats/:id
 * Get a chat transcript (public)
 */
chatsRoutes.get('/chats/:id', async (c) => {
  const { id } = c.req.param();

  try {
    const chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?')
      .bind(id)
      .first();

    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    return c.json(formatChatResponse(chat));
  } catch {
    return c.json({ error: 'Chat not found' }, 404);
  }
});

/**
 * DELETE /chats/:id
 * Delete a chat (admin only)
 */
chatsRoutes.delete('/chats/:id', adminAuth, async (c) => {
  const { id } = c.req.param();

  try {
    // Delete from chats table
    await c.env.DB.prepare('DELETE FROM chats WHERE id = ?').bind(id).run();

    // Also delete related user data
    await c.env.DB.prepare('DELETE FROM user_chats WHERE chat_id = ?')
      .bind(id)
      .run();
    await c.env.DB.prepare('DELETE FROM user_tags WHERE chat_id = ?')
      .bind(id)
      .run();
    await c.env.DB.prepare('DELETE FROM user_highlights WHERE chat_id = ?')
      .bind(id)
      .run();
  } catch (error) {
    console.error('Failed to delete chat:', error);
  }

  return c.json({ deleted: true });
});

/**
 * Format a database row into a chat response
 */
function formatChatResponse(row: Record<string, unknown>) {
  // Parse the stored JSON content if available
  let messages = [];
  if (row.content && typeof row.content === 'string') {
    try {
      const parsed = JSON.parse(row.content);
      messages = parsed.messages || [];
    } catch {
      // Ignore parse errors
    }
  }

  return {
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    createdAt: row.created_at,
    fetchedAt: row.fetched_at,
    messageCount: row.message_count,
    wordCount: row.word_count,
    messages,
  };
}
