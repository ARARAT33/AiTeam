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
