-- Turn incidents into first-class tickets with a real ticketing lifecycle:
-- human-readable ticket numbers, priority, an assignee, and an SLA clock.
ALTER TABLE incidents ADD COLUMN ticket_number TEXT;
ALTER TABLE incidents ADD COLUMN priority TEXT NOT NULL DEFAULT 'P3';
ALTER TABLE incidents ADD COLUMN assignee TEXT;
ALTER TABLE incidents ADD COLUMN sla_due_at TEXT;

-- Monotonic counter used to mint ticket numbers (RR-1001, RR-1002, ...).
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

-- Append-only audit trail. Every meaningful change — created, status change,
-- assignment, dispatch, inbound message, and agent tool call — lands here and
-- powers the real-time activity feed.
CREATE TABLE IF NOT EXISTS ticket_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ticket_id TEXT,
  type TEXT NOT NULL,        -- created | status_changed | priority_changed | assigned | note | dispatch | inbound_sms | inbound_call | tool_invoked | recording
  actor TEXT NOT NULL,       -- voice_agent | operator | system | caller | phone | sms
  message TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_created_at ON ticket_events (created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON ticket_events (ticket_id);

-- Backfill existing incidents so they look like real tickets.
UPDATE incidents
SET ticket_number = 'RR-' || (1000 + rowid)
WHERE ticket_number IS NULL;

UPDATE incidents
SET priority = CASE severity
  WHEN 'critical' THEN 'P1'
  WHEN 'high' THEN 'P2'
  WHEN 'medium' THEN 'P3'
  ELSE 'P4'
END
WHERE priority = 'P3';

-- Seed the counter past the highest backfilled ticket number (RR-1000+rowid)
-- so newly minted tickets continue the same series.
INSERT INTO counters (name, value)
VALUES ('ticket', (SELECT 1000 + COALESCE(MAX(rowid), 0) FROM incidents))
ON CONFLICT(name) DO UPDATE SET value = excluded.value;
