import {
  type Incident,
  type IncidentInput,
  incidentInputSchema,
  incidentStatuses,
} from "@/lib/incident-schema";

type IncidentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  caller_name: string;
  phone: string | null;
  address: string;
  damage_type: string;
  severity: string;
  status: string;
  source: string;
  summary: string;
  payload: string;
};

function getDb(env: CloudflareEnv): D1Database {
  const db = env.DB;
  if (!db) {
    throw new Error("D1 binding `DB` is not available. Configure it in wrangler.jsonc.");
  }
  return db;
}

function rowToIncident(row: IncidentRow): Incident {
  let extra: Partial<IncidentInput> = {};
  try {
    extra = JSON.parse(row.payload) as Partial<IncidentInput>;
  } catch {
    extra = {};
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    callerName: row.caller_name,
    phone: row.phone ?? undefined,
    address: row.address,
    damageType: row.damage_type as Incident["damageType"],
    severity: row.severity as Incident["severity"],
    status: row.status as Incident["status"],
    source: row.source as Incident["source"],
    summary: row.summary,
    affectedAreas: extra.affectedAreas ?? [],
    safetyRisks: extra.safetyRisks ?? [],
    immediateActions: extra.immediateActions ?? [],
    crewNeeds: extra.crewNeeds ?? [],
  };
}

export async function createIncident(env: CloudflareEnv, rawInput: unknown): Promise<Incident> {
  const input = incidentInputSchema.parse(rawInput);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = JSON.stringify({
    affectedAreas: input.affectedAreas,
    safetyRisks: input.safetyRisks,
    immediateActions: input.immediateActions,
    crewNeeds: input.crewNeeds,
  });

  await getDb(env)
    .prepare(
      `INSERT INTO incidents
        (id, created_at, updated_at, caller_name, phone, address, damage_type, severity, status, source, summary, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
    )
    .bind(
      id,
      now,
      now,
      input.callerName,
      input.phone ?? null,
      input.address,
      input.damageType,
      input.severity,
      input.source,
      input.summary,
      payload,
    )
    .run();

  return {
    ...input,
    id,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
}

export async function listIncidents(env: CloudflareEnv, limit = 50): Promise<Incident[]> {
  const { results } = await getDb(env)
    .prepare(`SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<IncidentRow>();
  return (results ?? []).map(rowToIncident);
}

export async function getIncident(env: CloudflareEnv, id: string): Promise<Incident | null> {
  const row = await getDb(env)
    .prepare(`SELECT * FROM incidents WHERE id = ?`)
    .bind(id)
    .first<IncidentRow>();
  return row ? rowToIncident(row) : null;
}

export async function updateIncidentStatus(
  env: CloudflareEnv,
  id: string,
  status: Incident["status"],
): Promise<void> {
  if (!incidentStatuses.includes(status)) {
    throw new Error(`Invalid incident status: ${status}`);
  }
  await getDb(env)
    .prepare(`UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, new Date().toISOString(), id)
    .run();
}

export type CallSummaryRecord = {
  conversationId: string;
  agentName?: string | null;
  status?: string | null;
  durationSeconds?: number | null;
  summary?: string | null;
  payload: unknown;
};

export async function recordCallSummary(env: CloudflareEnv, record: CallSummaryRecord): Promise<void> {
  await getDb(env)
    .prepare(
      `INSERT INTO call_summaries (conversation_id, agent_name, status, duration_seconds, summary, payload)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         agent_name = excluded.agent_name,
         status = excluded.status,
         duration_seconds = excluded.duration_seconds,
         summary = excluded.summary,
         payload = excluded.payload`,
    )
    .bind(
      record.conversationId,
      record.agentName ?? null,
      record.status ?? null,
      record.durationSeconds ?? null,
      record.summary ?? null,
      JSON.stringify(record.payload ?? {}),
    )
    .run();
}

export type NotificationRecord = {
  incidentId?: string | null;
  channel: "sms" | "call";
  direction: "outbound" | "inbound";
  toNumber?: string | null;
  fromNumber?: string | null;
  body?: string | null;
  twilioSid?: string | null;
  status?: string | null;
  errorCode?: string | null;
};

export async function logNotification(env: CloudflareEnv, record: NotificationRecord): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getDb(env)
    .prepare(
      `INSERT INTO notifications
        (id, created_at, updated_at, incident_id, channel, direction, to_number, from_number, body, twilio_sid, status, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      now,
      now,
      record.incidentId ?? null,
      record.channel,
      record.direction,
      record.toNumber ?? null,
      record.fromNumber ?? null,
      record.body ?? null,
      record.twilioSid ?? null,
      record.status ?? null,
      record.errorCode ?? null,
    )
    .run();
  return id;
}

export async function updateNotificationStatusBySid(
  env: CloudflareEnv,
  twilioSid: string,
  status: string,
  errorCode?: string | null,
): Promise<void> {
  await getDb(env)
    .prepare(
      `UPDATE notifications SET status = ?, error_code = ?, updated_at = ? WHERE twilio_sid = ?`,
    )
    .bind(status, errorCode ?? null, new Date().toISOString(), twilioSid)
    .run();
}

export async function saveRecording(
  env: CloudflareEnv,
  record: {
    recordingSid: string;
    callSid?: string | null;
    incidentId?: string | null;
    durationSeconds?: number | null;
    r2Key?: string | null;
    sourceUrl?: string | null;
  },
): Promise<void> {
  await getDb(env)
    .prepare(
      `INSERT INTO call_recordings (recording_sid, call_sid, incident_id, duration_seconds, r2_key, source_url)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(recording_sid) DO UPDATE SET
         call_sid = excluded.call_sid,
         incident_id = excluded.incident_id,
         duration_seconds = excluded.duration_seconds,
         r2_key = excluded.r2_key,
         source_url = excluded.source_url`,
    )
    .bind(
      record.recordingSid,
      record.callSid ?? null,
      record.incidentId ?? null,
      record.durationSeconds ?? null,
      record.r2Key ?? null,
      record.sourceUrl ?? null,
    )
    .run();
}

export type DispatchStats = {
  total: number;
  critical: number;
  active: number;
  resolved: number;
};

export async function getDispatchStats(env: CloudflareEnv): Promise<DispatchStats> {
  const row = await getDb(env)
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN status IN ('new', 'dispatched', 'on_site') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved
       FROM incidents`,
    )
    .first<{ total: number; critical: number; active: number; resolved: number }>();
  return {
    total: row?.total ?? 0,
    critical: row?.critical ?? 0,
    active: row?.active ?? 0,
    resolved: row?.resolved ?? 0,
  };
}
