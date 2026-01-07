-- DiaStack D1 Database Schema

-- Users table (Google OAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Chats are cached globally (public content)
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER,
  fetched_at INTEGER NOT NULL,
  message_count INTEGER,
  word_count INTEGER,
  content TEXT NOT NULL,
  user_id TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_chats_source ON chats(source);
CREATE INDEX IF NOT EXISTS idx_chats_fetched ON chats(fetched_at);
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);

-- User's imported chats and reading state
CREATE TABLE IF NOT EXISTS user_chats (
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  read_position INTEGER DEFAULT 0,
  is_read INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  is_bookmarked INTEGER DEFAULT 0,
  folder TEXT,
  imported_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, chat_id),
  FOREIGN KEY (chat_id) REFERENCES chats(id)
);

CREATE INDEX IF NOT EXISTS idx_user_chats_user ON user_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_folder ON user_chats(user_id, folder);

-- Tags (many-to-many)
CREATE TABLE IF NOT EXISTS user_tags (
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (user_id, chat_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_tag ON user_tags(user_id, tag);

-- Highlights and annotations
CREATE TABLE IF NOT EXISTS user_highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_highlights_chat ON user_highlights(user_id, chat_id);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  settings TEXT NOT NULL
);

-- Full-text search on chat content (title and text content)
CREATE VIRTUAL TABLE IF NOT EXISTS chats_fts USING fts5(
  id,
  title,
  text_content,
  content='',
  contentless_delete=1
);

-- Message-level full-text search for searching within messages
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
