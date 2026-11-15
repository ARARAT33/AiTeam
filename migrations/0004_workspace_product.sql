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
