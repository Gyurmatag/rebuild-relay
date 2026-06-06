-- Promote incidents from a demo echo into a tracked operational record.
ALTER TABLE incidents ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE incidents ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
ALTER TABLE incidents ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);

-- Every Twilio message/call we send or receive, with delivery tracking.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  incident_id TEXT,
  channel TEXT NOT NULL,        -- sms | call
  direction TEXT NOT NULL,      -- outbound | inbound
  to_number TEXT,
  from_number TEXT,
  body TEXT,
  twilio_sid TEXT,              -- MessageSid / CallSid
  status TEXT,                  -- queued | sent | delivered | failed | undelivered | completed ...
  error_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_incident ON notifications (incident_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sid ON notifications (twilio_sid);

-- Call recordings captured from the Twilio phone line, optionally mirrored to R2.
CREATE TABLE IF NOT EXISTS call_recordings (
  recording_sid TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  call_sid TEXT,
  incident_id TEXT,
  duration_seconds INTEGER,
  r2_key TEXT,
  source_url TEXT
);
