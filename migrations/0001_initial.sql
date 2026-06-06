CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  caller_name TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  damage_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS call_summaries (
  conversation_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  agent_name TEXT,
  status TEXT,
  duration_seconds INTEGER,
  summary TEXT,
  payload TEXT NOT NULL
);
