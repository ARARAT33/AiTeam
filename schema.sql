PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY,name TEXT NOT NULL,provider TEXT NOT NULL,model_id TEXT NOT NULL,base_url TEXT NOT NULL,encrypted_api_key TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,priority INTEGER NOT NULL DEFAULT 100,daily_limit INTEGER NOT NULL DEFAULT 100,daily_used INTEGER NOT NULL DEFAULT 0,usage_day TEXT NOT NULL DEFAULT '',max_concurrency INTEGER NOT NULL DEFAULT 1,active_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY,title TEXT NOT NULL,prompt TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',priority INTEGER NOT NULL DEFAULT 50,result TEXT,error TEXT,attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 3,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,started_at TEXT,finished_at TEXT);
CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(status,priority DESC,created_at ASC);
CREATE TABLE IF NOT EXISTS task_events (id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,agent TEXT NOT NULL,event TEXT NOT NULL,detail TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id,created_at);
CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY,task_id TEXT,kind TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
CREATE TABLE IF NOT EXISTS plugins (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',version TEXT NOT NULL DEFAULT '1.0.0',manifest TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,requires_approval INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 target_type TEXT NOT NULL,
 target_id TEXT,
 detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Chat workspace and generated file storage
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

-- Teams, projects, schedules, skills, MCP and tool permissions
CREATE TABLE IF NOT EXISTS agent_teams (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 model_ids_json TEXT NOT NULL DEFAULT '[]',
 consensus_rounds INTEGER NOT NULL DEFAULT 3,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 instructions TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled_tasks (
 id TEXT PRIMARY KEY,
 project_id TEXT,
 title TEXT NOT NULL,
 prompt TEXT NOT NULL,
 interval_minutes INTEGER NOT NULL DEFAULT 60,
 next_run_at TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 last_enqueued_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due ON scheduled_tasks(enabled,next_run_at);
CREATE TABLE IF NOT EXISTS skills (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 instructions TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_servers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 endpoint TEXT NOT NULL,
 encrypted_token TEXT,
 enabled INTEGER NOT NULL DEFAULT 0,
 discovered_tools_json TEXT NOT NULL DEFAULT '[]',
 last_status TEXT NOT NULL DEFAULT 'not_connected',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tool_permissions (
 tool_key TEXT PRIMARY KEY,
 enabled INTEGER NOT NULL DEFAULT 0,
 require_confirmation INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plugin_capabilities (
 plugin_id TEXT NOT NULL,
 capability TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0,
 require_confirmation INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(plugin_id,capability)
);
