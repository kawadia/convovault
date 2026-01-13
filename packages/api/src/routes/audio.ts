import { Hono } from 'hono';
import {
  GenerateAudioRequestSchema,
  type ChatTranscript,
  type AudioResponse,
} from '@convovault/shared';
import type { Env } from '../index';
import { sessionAuth, requireAuth } from '../middleware/auth';
import { generateDialogueAudio, estimateDuration } from '../services/geminiTts';

export const audioRoutes = new Hono<{ Bindings: Env }>();

// Apply session auth to all routes
audioRoutes.use('*', sessionAuth);

/**
 * GET /chats/:id/audio
 * Get audio status for a chat (public)
 */
audioRoutes.get('/chats/:id/audio', async (c) => {
  const { id } = c.req.param();

  try {
    // Get audio record
    const audio = await c.env.DB.prepare(
      'SELECT * FROM chat_audio WHERE chat_id = ?'
    )
      .bind(id)
      .first<{
        id: string;
        chat_id: string;
        status: string;
        voice_config: string;
        r2_key: string | null;
        duration_seconds: number | null;
        file_size: number | null;
        error_message: string | null;
      }>();

    if (!audio) {
      return c.json({
        chatId: id,
        status: 'none',
      } as AudioResponse);
    }

    const response: AudioResponse = {
      chatId: id,
      status: audio.status as AudioResponse['status'],
      voiceConfig: audio.voice_config ? JSON.parse(audio.voice_config) : undefined,
      duration: audio.duration_seconds ?? undefined,
      error: audio.error_message ?? undefined,
    };

    // Generate signed URL if audio is ready
    if (audio.status === 'ready' && audio.r2_key) {
      // For public R2 access, construct the URL directly
      // The bucket should be configured for public access
      response.url = `https://convovault-audio.${c.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${audio.r2_key}`;
    }

    return c.json(response);
  } catch (error) {
    console.error('Failed to get audio status:', error);
    return c.json({
      chatId: id,
      status: 'failed',
      error: 'Failed to get audio status',
    } as AudioResponse);
  }
});

/**
 * POST /chats/:id/audio
 * Generate audio for a chat (requires auth, owner only)
 */
audioRoutes.post('/chats/:id/audio', requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Parse request body
  const body = await c.req.json();
  const parseResult = GenerateAudioRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Invalid request', details: parseResult.error.issues },
      400
    );
  }

  const voiceConfig = parseResult.data;

  try {
    // Get the chat to verify ownership and get content
    const chat = await c.env.DB.prepare(
      'SELECT id, user_id, content FROM chats WHERE id = ?'
    )
      .bind(id)
      .first<{ id: string; user_id: string | null; content: string }>();

    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    // Check ownership
    if (chat.user_id !== user?.id) {
      return c.json({ error: 'Only the chat owner can generate audio' }, 403);
    }

    // Parse chat content
    const transcript: ChatTranscript = JSON.parse(chat.content);

    // Check if audio already exists
    const existingAudio = await c.env.DB.prepare(
      'SELECT id, status FROM chat_audio WHERE chat_id = ?'
    )
      .bind(id)
      .first<{ id: string; status: string }>();

    // If already generating, return current status
    if (existingAudio?.status === 'generating') {
      return c.json({
        chatId: id,
        status: 'generating',
        progress: 50,
      } as AudioResponse);
    }

    // Create or update audio record with 'generating' status
    const audioId = existingAudio?.id || crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    if (existingAudio) {
      await c.env.DB.prepare(
        `UPDATE chat_audio SET status = 'generating', voice_config = ?, error_message = NULL, updated_at = ? WHERE id = ?`
      )
        .bind(JSON.stringify(voiceConfig), now, audioId)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO chat_audio (id, chat_id, status, voice_config, created_at, updated_at) VALUES (?, ?, 'generating', ?, ?, ?)`
      )
        .bind(audioId, id, JSON.stringify(voiceConfig), now, now)
        .run();
    }

    // Generate audio (this can take a while)
    try {
      const { audioData, mimeType } = await generateDialogueAudio(
        transcript,
        voiceConfig,
        c.env.GEMINI_API_KEY
      );

      // Upload to R2
      const r2Key = `audio/${id}/${audioId}.wav`;
      await c.env.AUDIO_BUCKET.put(r2Key, audioData, {
        httpMetadata: {
          contentType: mimeType,
        },
      });

      // Estimate duration
      const duration = estimateDuration(transcript);

      // Update record with success
      await c.env.DB.prepare(
        `UPDATE chat_audio SET status = 'ready', r2_key = ?, duration_seconds = ?, file_size = ?, updated_at = ? WHERE id = ?`
      )
        .bind(r2Key, duration, audioData.byteLength, Math.floor(Date.now() / 1000), audioId)
        .run();

      return c.json({
        chatId: id,
        status: 'ready',
        voiceConfig,
        duration,
      } as AudioResponse);
    } catch (genError) {
      // Update record with error
      const errorMessage =
        genError instanceof Error ? genError.message : 'Unknown error';
      await c.env.DB.prepare(
        `UPDATE chat_audio SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
      )
        .bind(errorMessage, Math.floor(Date.now() / 1000), audioId)
        .run();

      console.error('Audio generation failed:', genError);
      return c.json({
        chatId: id,
        status: 'failed',
        error: errorMessage,
      } as AudioResponse);
    }
  } catch (error) {
    console.error('Failed to generate audio:', error);
    return c.json(
      {
        chatId: id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as AudioResponse,
      500
    );
  }
});

/**
 * DELETE /chats/:id/audio
 * Delete audio for a chat (owner only)
 */
audioRoutes.delete('/chats/:id/audio', requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  try {
    // Get the chat to verify ownership
    const chat = await c.env.DB.prepare('SELECT user_id FROM chats WHERE id = ?')
      .bind(id)
      .first<{ user_id: string | null }>();

    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    // Check ownership
    if (chat.user_id !== user?.id) {
      return c.json({ error: 'Only the chat owner can delete audio' }, 403);
    }

    // Get audio record to find R2 key
    const audio = await c.env.DB.prepare(
      'SELECT r2_key FROM chat_audio WHERE chat_id = ?'
    )
      .bind(id)
      .first<{ r2_key: string | null }>();

    if (audio?.r2_key) {
      // Delete from R2
      await c.env.AUDIO_BUCKET.delete(audio.r2_key);
    }

    // Delete from database
    await c.env.DB.prepare('DELETE FROM chat_audio WHERE chat_id = ?')
      .bind(id)
      .run();

    return c.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete audio:', error);
    return c.json({ error: 'Failed to delete audio' }, 500);
  }
});

/**
 * GET /chats/:id/audio/stream
 * Stream audio from R2 (public)
 */
audioRoutes.get('/chats/:id/audio/stream', async (c) => {
  const { id } = c.req.param();

  try {
    // Get audio record
    const audio = await c.env.DB.prepare(
      'SELECT r2_key, status FROM chat_audio WHERE chat_id = ?'
    )
      .bind(id)
      .first<{ r2_key: string | null; status: string }>();

    if (!audio || audio.status !== 'ready' || !audio.r2_key) {
      return c.json({ error: 'Audio not found' }, 404);
    }

    // Get from R2
    const object = await c.env.AUDIO_BUCKET.get(audio.r2_key);

    if (!object) {
      return c.json({ error: 'Audio file not found' }, 404);
    }

    // Return audio stream
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'audio/wav',
        'Content-Length': object.size.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Failed to stream audio:', error);
    return c.json({ error: 'Failed to stream audio' }, 500);
  }
});
