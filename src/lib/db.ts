import {
  type Incident,
  type IncidentInput,
  type Priority,
  type TicketEvent,
  type TicketEventType,
  incidentInputSchema,
  incidentStatuses,
  severityToPriority,
  slaMinutes,
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
  ticket_number: string | null;
  priority: string | null;
  assignee: string | null;
  sla_due_at: string | null;
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
    ticketNumber: row.ticket_number ?? `RR-${row.id.slice(0, 6)}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    callerName: row.caller_name,
    phone: row.phone ?? undefined,
    address: row.address,
    damageType: row.damage_type as Incident["damageType"],
    severity: row.severity as Incident["severity"],
    status: row.status as Incident["status"],
    priority: (row.priority as Priority) ?? severityToPriority(row.severity as Incident["severity"]),
    assignee: row.assignee,
    slaDueAt: row.sla_due_at,
    source: row.source as Incident["source"],
    summary: row.summary,
    affectedAreas: extra.affectedAreas ?? [],
    safetyRisks: extra.safetyRisks ?? [],
    immediateActions: extra.immediateActions ?? [],
    crewNeeds: extra.crewNeeds ?? [],
  };
}

function rowToEvent(row: {
  id: string;
  created_at: string;
  ticket_id: string | null;
  type: string;
  actor: string;
  message: string;
  metadata: string | null;
}): TicketEvent {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    ticketId: row.ticket_id,
    type: row.type as TicketEventType,
    actor: row.actor,
    message: row.message,
    metadata,
  };
}

async function nextTicketNumber(env: CloudflareEnv): Promise<string> {
  const row = await getDb(env)
    .prepare(
      `INSERT INTO counters (name, value) VALUES ('ticket', 1001)
       ON CONFLICT(name) DO UPDATE SET value = value + 1
       RETURNING value`,
    )
    .first<{ value: number }>();
  return `RR-${row?.value ?? 1001}`;
}

export async function addTicketEvent(
  env: CloudflareEnv,
  event: {
    ticketId: string | null;
    type: TicketEventType;
    actor: string;
    message: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<TicketEvent> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await getDb(env)
    .prepare(
      `INSERT INTO ticket_events (id, created_at, ticket_id, type, actor, message, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      createdAt,
      event.ticketId,
      event.type,
      event.actor,
      event.message,
      event.metadata ? JSON.stringify(event.metadata) : null,
    )
    .run();
  return {
    id,
    createdAt,
    ticketId: event.ticketId,
    type: event.type,
    actor: event.actor,
    message: event.message,
    metadata: event.metadata ?? null,
  };
}

export async function listTicketEvents(env: CloudflareEnv, limit = 40): Promise<TicketEvent[]> {
  const { results } = await getDb(env)
    .prepare(`SELECT * FROM ticket_events ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<Parameters<typeof rowToEvent>[0]>();
  return (results ?? []).map(rowToEvent).reverse();
}

/** Events strictly newer than the given ISO cursor (ascending). Used by SSE. */
export async function getEventsSince(env: CloudflareEnv, sinceIso: string, limit = 50): Promise<TicketEvent[]> {
  const { results } = await getDb(env)
    .prepare(`SELECT * FROM ticket_events WHERE created_at > ? ORDER BY created_at ASC LIMIT ?`)
    .bind(sinceIso, limit)
    .all<Parameters<typeof rowToEvent>[0]>();
  return (results ?? []).map(rowToEvent);
}

export async function createIncident(env: CloudflareEnv, rawInput: unknown): Promise<Incident> {
  const input = incidentInputSchema.parse(rawInput);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const priority = severityToPriority(input.severity);
  const slaDueAt = new Date(Date.now() + slaMinutes[priority] * 60_000).toISOString();
  const ticketNumber = await nextTicketNumber(env);
  const payload = JSON.stringify({
    affectedAreas: input.affectedAreas,
    safetyRisks: input.safetyRisks,
    immediateActions: input.immediateActions,
    crewNeeds: input.crewNeeds,
  });

  await getDb(env)
    .prepare(
      `INSERT INTO incidents
        (id, created_at, updated_at, caller_name, phone, address, damage_type, severity, status, source, summary, payload, ticket_number, priority, sla_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)`,
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
      ticketNumber,
      priority,
      slaDueAt,
    )
    .run();

  const incident: Incident = {
    ...input,
    id,
    ticketNumber,
    status: "new",
    priority,
    assignee: null,
    slaDueAt,
    createdAt: now,
    updatedAt: now,
  };

  await addTicketEvent(env, {
    ticketId: id,
    type: "created",
    actor: input.source === "voice_agent" ? "voice_agent" : input.source === "web" ? "operator" : input.source,
    message: `${ticketNumber} opened — ${priority} ${input.severity} ${input.damageType} loss at ${input.address}`,
    metadata: { ticketNumber, priority, severity: input.severity, source: input.source },
  });

  return incident;
}

export type IncidentPatch = {
  severity?: Incident["severity"];
  summary?: string;
  address?: string;
  damageType?: Incident["damageType"];
  addSafetyRisk?: string;
  addCrewNeed?: string;
};

/** Apply an in-call update to a ticket (used by the agent's update tool). */
export async function updateIncidentDetails(
  env: CloudflareEnv,
  id: string,
  patch: IncidentPatch,
  actor = "voice_agent",
): Promise<Incident | null> {
  const current = await getIncident(env, id);
  if (!current) return null;

  const severity = patch.severity ?? current.severity;
  const summary = patch.summary ?? current.summary;
  const address = patch.address ?? current.address;
  const damageType = patch.damageType ?? current.damageType;
  const safetyRisks = patch.addSafetyRisk
    ? [...current.safetyRisks, patch.addSafetyRisk]
    : current.safetyRisks;
  const crewNeeds = patch.addCrewNeed ? [...current.crewNeeds, patch.addCrewNeed] : current.crewNeeds;

  const priority = severityToPriority(severity);
  const slaDueAt =
    severity !== current.severity
      ? new Date(Date.now() + slaMinutes[priority] * 60_000).toISOString()
      : current.slaDueAt ?? null;

  const payload = JSON.stringify({
    affectedAreas: current.affectedAreas,
    safetyRisks,
    immediateActions: current.immediateActions,
    crewNeeds,
  });

  await getDb(env)
    .prepare(
      `UPDATE incidents SET severity = ?, summary = ?, address = ?, damage_type = ?, priority = ?, sla_due_at = ?, payload = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(severity, summary, address, damageType, priority, slaDueAt, payload, new Date().toISOString(), id)
    .run();

  if (severity !== current.severity) {
    await addTicketEvent(env, {
      ticketId: id,
      type: "priority_changed",
      actor,
      message: `${current.ticketNumber} re-prioritised to ${priority} (${severity})`,
      metadata: { severity, priority },
    });
  }
  if (patch.addSafetyRisk) {
    await addTicketEvent(env, {
      ticketId: id,
      type: "note",
      actor,
      message: `Safety risk added to ${current.ticketNumber}: ${patch.addSafetyRisk}`,
    });
  }

  return getIncident(env, id);
}

export async function addNote(
  env: CloudflareEnv,
  id: string,
  note: string,
  actor = "voice_agent",
): Promise<Incident | null> {
  const incident = await getIncident(env, id);
  if (!incident) return null;
  await getDb(env)
    .prepare(`UPDATE incidents SET updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), id)
    .run();
  await addTicketEvent(env, {
    ticketId: id,
    type: "note",
    actor,
    message: `Note on ${incident.ticketNumber}: ${note}`,
  });
  return incident;
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

/** Resolve a ticket by its UUID or its human ticket number (RR-1042). */
export async function findIncident(env: CloudflareEnv, ref: string): Promise<Incident | null> {
  const row = await getDb(env)
    .prepare(`SELECT * FROM incidents WHERE id = ? OR ticket_number = ? LIMIT 1`)
    .bind(ref, ref)
    .first<IncidentRow>();
  return row ? rowToIncident(row) : null;
}

export async function updateIncidentStatus(
  env: CloudflareEnv,
  id: string,
  status: Incident["status"],
  actor = "operator",
): Promise<void> {
  if (!incidentStatuses.includes(status)) {
    throw new Error(`Invalid incident status: ${status}`);
  }
  await getDb(env)
    .prepare(`UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, new Date().toISOString(), id)
    .run();
  const incident = await getIncident(env, id);
  await addTicketEvent(env, {
    ticketId: id,
    type: "status_changed",
    actor,
    message: `${incident?.ticketNumber ?? id} moved to ${status.replace(/_/g, " ")}`,
    metadata: { status },
  });
}

export async function assignTicket(
  env: CloudflareEnv,
  id: string,
  assignee: string,
  actor = "operator",
): Promise<Incident | null> {
  await getDb(env)
    .prepare(`UPDATE incidents SET assignee = ?, updated_at = ? WHERE id = ?`)
    .bind(assignee, new Date().toISOString(), id)
    .run();
  const incident = await getIncident(env, id);
  await addTicketEvent(env, {
    ticketId: id,
    type: "assigned",
    actor,
    message: `${incident?.ticketNumber ?? id} assigned to ${assignee}`,
    metadata: { assignee },
  });
  return incident;
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
        SUM(CASE WHEN status IN ('new', 'triage', 'dispatched', 'on_site') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS resolved
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
