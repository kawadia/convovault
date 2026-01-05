import { Hono } from 'hono';
import { ImportChatRequestSchema } from '@convovault/shared';
import { z } from 'zod';
import type { Env } from '../index';
import { adminAuth } from '../middleware/auth';
import { claudeWebParser } from '../parsers/claude-web';

export const chatsRoutes = new Hono<{ Bindings: Env }>();

// List of supported parsers
const parsers = [claudeWebParser];

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

  // Use provided HTML or fetch from URL
  let html: string;

  if (providedHtml) {
    // Use pre-rendered HTML from browser
    html = providedHtml;
  } else {
    // Try fetching the URL (may not work for RSC pages)
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ConvoVault/1.0',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        return c.json(
          { error: `Failed to fetch URL: ${response.status}` },
          500
        );
      }

      html = await response.text();
    } catch (error) {
      return c.json(
        { error: `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}` },
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
