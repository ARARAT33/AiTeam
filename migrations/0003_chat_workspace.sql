CREATE TABLE IF NOT EXISTS conversations (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL DEFAULT 'New conversation',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE TABLE IF NOT EXISTS chat_messages (
 id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('user','assistant')),
 content TEXT NOT NULL,
 attachments_json TEXT NOT NULL DEFAULT '[]',
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS chat_attachments (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 content_base64 TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_created ON chat_attachments(created_at DESC);
CREATE TABLE IF NOT EXISTS workspace_files (
 path TEXT PRIMARY KEY,
 content TEXT NOT NULL,
 mime_type TEXT NOT NULL DEFAULT 'text/plain',
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspace_files_updated ON workspace_files(updated_at DESC);
