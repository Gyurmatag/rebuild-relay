-- External ticketing connectors: push every incident out to the customer's own
-- ticketing system via a remote MCP server, a generic API/webhook, or Linear.
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL,
  type TEXT NOT NULL,          -- webhook | mcp | linear
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL,        -- JSON (may contain secrets; redacted on read)
  last_status TEXT,            -- ok | error | untested
  last_detail TEXT,
  last_checked_at TEXT
);

-- Links an internal ticket to the record it created in an external system.
CREATE TABLE IF NOT EXISTS ticket_links (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ticket_id TEXT NOT NULL,
  connector_id TEXT NOT NULL,
  connector_name TEXT,
  connector_type TEXT,
  external_id TEXT,
  external_url TEXT,
  status TEXT NOT NULL,        -- synced | error
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_ticket_links_ticket ON ticket_links (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_connector ON ticket_links (connector_id);
