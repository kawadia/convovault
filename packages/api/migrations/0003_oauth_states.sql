-- Migration number: 0002 	 2024-01-06T20:58:33.000Z
CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
