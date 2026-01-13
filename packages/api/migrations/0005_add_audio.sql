-- Audio generation metadata table
CREATE TABLE IF NOT EXISTS chat_audio (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  voice_config TEXT NOT NULL,
  r2_key TEXT,
  duration_seconds REAL,
  file_size INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_audio_chat ON chat_audio(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_audio_status ON chat_audio(status);
