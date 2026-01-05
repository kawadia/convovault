-- Migration: Add message-level full-text search
-- This enables searching within individual messages and linking directly to them

-- Create FTS5 virtual table for message content
-- Using contentless FTS5 for efficiency (we store metadata separately)
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='',
  contentless_delete=1
);

-- Metadata table to map FTS rowids to chat/message info
CREATE TABLE IF NOT EXISTS messages_fts_meta (
  rowid INTEGER PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  role TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_fts_meta_chat ON messages_fts_meta(chat_id);
