import { Hono } from 'hono';
import { ImportChatRequestSchema, ChatTranscript } from '@convovault/shared';
import { z } from 'zod';
import type { Env } from '../index';
import { sessionAuth, requireAuth } from '../middleware/auth';
import { claudeWebParser } from '../parsers/claude-web';

export const chatsRoutes = new Hono<{ Bindings: Env }>();

// Apply session auth to all routes - attaches user to context if logged in
chatsRoutes.use('*', sessionAuth);

// List of supported parsers
const parsers = [claudeWebParser];

/**
 * Index all messages from a chat into the FTS table
 */
async function indexChatMessages(db: D1Database, transcript: ChatTranscript): Promise<void> {
  for (const message of transcript.messages) {
    // Combine all content blocks into one text
    const textContent = message.content
      .map(block => block.content)
      .join('\n');

    if (!textContent.trim()) continue;

    // Insert into FTS and metadata tables
    // First insert metadata to get the rowid
    const metaResult = await db.prepare(
      'INSERT INTO messages_fts_meta (chat_id, message_index, role) VALUES (?, ?, ?)'
    )
      .bind(transcript.id, message.index, message.role)
      .run();

    const rowid = metaResult.meta.last_row_id;

    // Then insert into FTS with the same rowid
    await db.prepare(
      'INSERT INTO messages_fts (rowid, content) VALUES (?, ?)'
    )
      .bind(rowid, textContent)
      .run();
  }
}

/**
 * Remove all FTS entries for a chat
 */
async function removeChatFromFTS(db: D1Database, chatId: string): Promise<void> {
  // Get all rowids for this chat
  const rows = await db.prepare(
    'SELECT rowid FROM messages_fts_meta WHERE chat_id = ?'
  )
    .bind(chatId)
    .all();

  // Delete from FTS and metadata
  for (const row of rows.results || []) {
    await db.prepare('DELETE FROM messages_fts WHERE rowid = ?')
      .bind(row.rowid)
      .run();
  }

  await db.prepare('DELETE FROM messages_fts_meta WHERE chat_id = ?')
    .bind(chatId)
    .run();
}

/**
 * Fetch rendered HTML using Cloudflare Browser Rendering REST API
 * This bypasses Cloudflare's bot protection and waits for React to hydrate
 */
async function fetchRenderedHtml(url: string, env: Env): Promise<string> {
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

// Extended schema for import with optional HTML content
const ImportWithHtmlSchema = z.object({
  url: z.string().url(),
  html: z.string().optional(), // Pre-rendered HTML from browser
});

/**
 * POST /chats/import
 * Import a chat from a URL (requires login)
 *
 * If `html` is provided in the body, it will be used directly.
 * Otherwise, the URL will be fetched (note: RSC pages may not parse correctly).
 */
chatsRoutes.post('/chats/import', requireAuth, async (c) => {
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

  // Store in database with user_id of the importer
  const user = c.get('user');
  try {
    await c.env.DB.prepare(
      `INSERT INTO chats (id, source, source_url, title, created_at, fetched_at, message_count, word_count, content, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        JSON.stringify(transcript),
        user?.id || null
      )
      .run();

    // Index messages for full-text search
    await indexChatMessages(c.env.DB, transcript);
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
  const user = c.get('user');
  try {
    let sql = `
      SELECT
        c.id, c.source, c.source_url, c.title, c.created_at, c.fetched_at,
        c.message_count, c.word_count, c.content, c.user_id,
        COALESCE(uc.is_favorite, 0) as is_favorite,
        COALESCE(uc.is_bookmarked, 0) as is_bookmarked
      FROM chats c
      LEFT JOIN user_chats uc ON c.id = uc.chat_id AND uc.user_id = ?
      ORDER BY c.fetched_at DESC
    `;
    const result = await c.env.DB.prepare(sql).bind(user?.id || 'anonymous').all();

    const chats = (result.results || []).map((row) => {
      // Extract participants from content JSON
      let participants = undefined;
      if (row.content && typeof row.content === 'string') {
        try {
          const parsed = JSON.parse(row.content);
          participants = parsed.participants;
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
        participants,
        userId: row.user_id, // Include owner ID for permission checks
        isFavorite: Boolean(row.is_favorite),
        isBookmarked: Boolean(row.is_bookmarked),
      };
    });

    return c.json({ chats });
  } catch (error) {
    console.error('Failed to list chats:', error);
    return c.json({ chats: [] });
  }
});

/**
 * GET /chats/:id
 * Get a chat transcript (public)
 */
chatsRoutes.get('/chats/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  try {
    const chat = await c.env.DB.prepare(`
      SELECT c.*, COALESCE(uc.is_favorite, 0) as is_favorite, COALESCE(uc.is_bookmarked, 0) as is_bookmarked
      FROM chats c
      LEFT JOIN user_chats uc ON c.id = uc.chat_id AND uc.user_id = ?
      WHERE c.id = ?
    `)
      .bind(user?.id || 'anonymous', id)
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
 * POST /chats/:id/favorite
 * Toggle favorite status
 */
chatsRoutes.post('/chats/:id/favorite', requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({}));
  const isFavorite = body.favorite === true ? 1 : 0;

  try {
    // Check if user_chat entry exists
    const existing = await c.env.DB.prepare(
      'SELECT chat_id FROM user_chats WHERE user_id = ? AND chat_id = ?'
    )
      .bind(user.id, id)
      .first();

    if (existing) {
      // Update
      await c.env.DB.prepare(
        'UPDATE user_chats SET is_favorite = ? WHERE user_id = ? AND chat_id = ?'
      )
        .bind(isFavorite, user.id, id)
        .run();
    } else {
      // Insert
      const now = Math.floor(Date.now() / 1000);
      await c.env.DB.prepare(
        'INSERT INTO user_chats (user_id, chat_id, is_favorite, imported_at) VALUES (?, ?, ?, ?)'
      )
        .bind(user.id, id, isFavorite, now)
        .run();
    }

    return c.json({ favorite: Boolean(isFavorite) });
  } catch (error) {
    console.error('Failed to favorite chat:', error);
    return c.json({ error: 'Failed to update favorite status' }, 500);
  }
});

/**
 * POST /chats/:id/bookmark
 * Toggle bookmark status
 */
chatsRoutes.post('/chats/:id/bookmark', requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({}));
  const isBookmarked = body.bookmark === true ? 1 : 0;

  try {
    // Check if user_chat entry exists
    const existing = await c.env.DB.prepare(
      'SELECT chat_id FROM user_chats WHERE user_id = ? AND chat_id = ?'
    )
      .bind(user.id, id)
      .first();

    if (existing) {
      // Update
      await c.env.DB.prepare(
        'UPDATE user_chats SET is_bookmarked = ? WHERE user_id = ? AND chat_id = ?'
      )
        .bind(isBookmarked, user.id, id)
        .run();
    } else {
      // Insert
      const now = Math.floor(Date.now() / 1000);
      await c.env.DB.prepare(
        'INSERT INTO user_chats (user_id, chat_id, is_bookmarked, imported_at) VALUES (?, ?, ?, ?)'
      )
        .bind(user.id, id, isBookmarked, now)
        .run();
    }

    return c.json({ bookmark: Boolean(isBookmarked) });
  } catch (error) {
    console.error('Failed to bookmark chat:', error);
    return c.json({ error: 'Failed to update bookmark status' }, 500);
  }
});

/**
 * DELETE /chats/:id
 * Delete a chat (owner or admin)
 */
chatsRoutes.delete('/chats/:id', requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check if user can delete this chat (owner or admin)
  const chat = await c.env.DB.prepare('SELECT user_id FROM chats WHERE id = ?')
    .bind(id)
    .first<{ user_id: string | null }>();

  if (!chat) {
    return c.json({ error: 'Chat not found' }, 404);
  }

  const isOwner = chat.user_id === user?.id;
  const isAdmin = user?.role === 'admin';

  if (!isOwner && !isAdmin) {
    return c.json({ error: 'You can only delete your own chats' }, 403);
  }

  try {
    // Delete from chats table
    await c.env.DB.prepare('DELETE FROM chats WHERE id = ?').bind(id).run();

    // Delete from FTS
    await removeChatFromFTS(c.env.DB, id);

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
 * Generate a snippet around a search term in text
 */
function generateSnippet(text: string, searchTerm: string, contextChars: number = 60): string {
  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) {
    // Term not found, return beginning of text
    return text.substring(0, contextChars * 2) + (text.length > contextChars * 2 ? '...' : '');
  }

  const start = Math.max(0, index - contextChars);
  const end = Math.min(text.length, index + searchTerm.length + contextChars);

  let snippet = '';
  if (start > 0) snippet += '...';
  snippet += text.substring(start, index);
  snippet += '**' + text.substring(index, index + searchTerm.length) + '**';
  snippet += text.substring(index + searchTerm.length, end);
  if (end < text.length) snippet += '...';

  return snippet;
}

/**
 * GET /search
 * Search messages across all chats or within a specific chat
 * Query params:
 *   - q: search query (required, min 2 chars)
 *   - chatId: optional chat ID to filter results to a specific chat
 */
chatsRoutes.get('/search', async (c) => {
  const query = c.req.query('q');
  const chatId = c.req.query('chatId');

  if (!query || query.trim().length < 2) {
    return c.json({ results: [] });
  }

  try {
    // Search using FTS5 MATCH - contentless tables don't support snippet()
    // so we fetch the chat content separately to generate snippets
    // If chatId is provided, filter to that specific chat
    const sqlQuery = chatId
      ? `
        SELECT
          m.chat_id,
          m.message_index,
          m.role,
          c.title as chat_title,
          c.content as chat_content
        FROM messages_fts
        JOIN messages_fts_meta m ON messages_fts.rowid = m.rowid
        JOIN chats c ON m.chat_id = c.id
        WHERE messages_fts MATCH ? AND m.chat_id = ?
        ORDER BY m.message_index
        LIMIT 100
      `
      : `
        SELECT
          m.chat_id,
          m.message_index,
          m.role,
          c.title as chat_title,
          c.content as chat_content
        FROM messages_fts
        JOIN messages_fts_meta m ON messages_fts.rowid = m.rowid
        JOIN chats c ON m.chat_id = c.id
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT 50
      `;

    const stmt = c.env.DB.prepare(sqlQuery);
    const results = chatId
      ? await stmt.bind(query, chatId).all()
      : await stmt.bind(query).all();

    const searchResults = (results.results || []).map((row) => {
      // Extract message content from the stored JSON
      let snippet = '';
      try {
        const chatData = JSON.parse(row.chat_content as string);
        const message = chatData.messages?.find((m: { index: number }) => m.index === row.message_index);
        if (message) {
          // Combine all content blocks
          const fullText = message.content
            .map((block: { content: string }) => block.content)
            .join(' ')
            .replace(/\n+/g, ' ');
          snippet = generateSnippet(fullText, query);
        }
      } catch {
        snippet = '';
      }

      return {
        chatId: row.chat_id,
        chatTitle: row.chat_title,
        messageIndex: row.message_index,
        role: row.role,
        snippet,
      };
    });

    return c.json({ results: searchResults });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ results: [], error: 'Search failed' });
  }
});

/**
 * Format a database row into a chat response
 */
function formatChatResponse(row: Record<string, unknown>) {
  // Parse the stored JSON content if available
  let messages = [];
  let participants = undefined;
  if (row.content && typeof row.content === 'string') {
    try {
      const parsed = JSON.parse(row.content);
      messages = parsed.messages || [];
      participants = parsed.participants;
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
    participants,
    isFavorite: Boolean(row.is_favorite),
    isBookmarked: Boolean(row.is_bookmarked),
  };
}
