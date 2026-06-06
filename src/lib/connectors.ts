import { addTicketEvent } from "@/lib/db";
import type { Incident, Priority } from "@/lib/incident-schema";
import { refreshAccessToken } from "@/lib/linear-oauth";
import { mcpCallTool, mcpListTools } from "@/lib/mcp-client";

export const connectorTypes = ["webhook", "mcp", "linear"] as const;
export type ConnectorType = (typeof connectorTypes)[number];

export type ConnectorConfig = Record<string, string>;

export type Connector = {
  id: string;
  createdAt: string;
  name: string;
  type: ConnectorType;
  enabled: boolean;
  config: ConnectorConfig;
  lastStatus: "ok" | "error" | "untested" | null;
  lastDetail: string | null;
  lastCheckedAt: string | null;
};

/** Config keys treated as secrets — never returned to the client. */
const SECRET_KEYS = new Set(["token", "apiKey", "secret", "authorization", "refreshToken"]);

type ConnectorRow = {
  id: string;
  created_at: string;
  name: string;
  type: string;
  enabled: number;
  config: string;
  last_status: string | null;
  last_detail: string | null;
  last_checked_at: string | null;
};

function getDb(env: CloudflareEnv): D1Database {
  if (!env.DB) throw new Error("D1 binding `DB` is not available.");
  return env.DB;
}

function rowToConnector(row: ConnectorRow): Connector {
  let config: ConnectorConfig = {};
  try {
    config = JSON.parse(row.config) as ConnectorConfig;
  } catch {
    config = {};
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    type: row.type as ConnectorType,
    enabled: row.enabled === 1,
    config,
    lastStatus: (row.last_status as Connector["lastStatus"]) ?? "untested",
    lastDetail: row.last_detail,
    lastCheckedAt: row.last_checked_at,
  };
}

/** Strip secret values for safe transport to the browser. */
export function redactConnector(connector: Connector): Connector {
  const config: ConnectorConfig = {};
  for (const [key, value] of Object.entries(connector.config)) {
    config[key] = SECRET_KEYS.has(key) ? (value ? "••••••" : "") : value;
  }
  return { ...connector, config };
}

export async function listConnectors(env: CloudflareEnv): Promise<Connector[]> {
  const { results } = await getDb(env)
    .prepare(`SELECT * FROM connectors ORDER BY created_at DESC`)
    .all<ConnectorRow>();
  return (results ?? []).map(rowToConnector);
}

export async function getConnector(env: CloudflareEnv, id: string): Promise<Connector | null> {
  const row = await getDb(env).prepare(`SELECT * FROM connectors WHERE id = ?`).bind(id).first<ConnectorRow>();
  return row ? rowToConnector(row) : null;
}

export async function createConnector(
  env: CloudflareEnv,
  input: { name: string; type: ConnectorType; config: ConnectorConfig },
): Promise<Connector> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getDb(env)
    .prepare(
      `INSERT INTO connectors (id, created_at, updated_at, name, type, enabled, config, last_status)
       VALUES (?, ?, ?, ?, ?, 1, ?, 'untested')`,
    )
    .bind(id, now, now, input.name, input.type, JSON.stringify(input.config))
    .run();
  const connector = await getConnector(env, id);
  if (!connector) throw new Error("Failed to create connector");
  return connector;
}

export async function setConnectorEnabled(env: CloudflareEnv, id: string, enabled: boolean): Promise<void> {
  await getDb(env)
    .prepare(`UPDATE connectors SET enabled = ?, updated_at = ? WHERE id = ?`)
    .bind(enabled ? 1 : 0, new Date().toISOString(), id)
    .run();
}

export async function deleteConnector(env: CloudflareEnv, id: string): Promise<void> {
  await getDb(env).prepare(`DELETE FROM connectors WHERE id = ?`).bind(id).run();
}

async function setConnectorStatus(
  env: CloudflareEnv,
  id: string,
  status: "ok" | "error",
  detail: string,
): Promise<void> {
  await getDb(env)
    .prepare(`UPDATE connectors SET last_status = ?, last_detail = ?, last_checked_at = ? WHERE id = ?`)
    .bind(status, detail.slice(0, 300), new Date().toISOString(), id)
    .run();
}

/**
 * For OAuth-backed MCP connectors, refresh the access token if it is missing or
 * within a minute of expiry, persisting the new token. Returns a connector with
 * a valid bearer token in `config.token`.
 */
async function ensureFreshToken(env: CloudflareEnv, connector: Connector): Promise<Connector> {
  if (connector.type !== "mcp" || connector.config.oauth !== "true") return connector;

  const expiresAt = connector.config.tokenExpiresAt ? Date.parse(connector.config.tokenExpiresAt) : 0;
  const stillValid = expiresAt && expiresAt - Date.now() > 60_000;
  if (stillValid) return connector;

  const refreshToken = connector.config.refreshToken;
  const clientId = connector.config.clientId;
  if (!refreshToken || !clientId) return connector; // nothing to refresh with

  const token = await refreshAccessToken({ refreshToken, clientId });
  const config: ConnectorConfig = {
    ...connector.config,
    token: token.access_token,
    refreshToken: token.refresh_token ?? refreshToken,
    tokenExpiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
  };
  await getDb(env)
    .prepare(`UPDATE connectors SET config = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(config), new Date().toISOString(), connector.id)
    .run();
  return { ...connector, config };
}

async function addTicketLink(
  env: CloudflareEnv,
  link: {
    ticketId: string;
    connector: Connector;
    externalId?: string | null;
    externalUrl?: string | null;
    status: "synced" | "error";
    error?: string | null;
  },
): Promise<void> {
  await getDb(env)
    .prepare(
      `INSERT INTO ticket_links
        (id, ticket_id, connector_id, connector_name, connector_type, external_id, external_url, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      link.ticketId,
      link.connector.id,
      link.connector.name,
      link.connector.type,
      link.externalId ?? null,
      link.externalUrl ?? null,
      link.status,
      link.error ?? null,
    )
    .run();
}

export type TicketLink = {
  id: string;
  connectorName: string | null;
  connectorType: string | null;
  externalId: string | null;
  externalUrl: string | null;
  status: string;
  error: string | null;
  createdAt: string;
};

export async function listTicketLinks(env: CloudflareEnv, ticketId: string): Promise<TicketLink[]> {
  const { results } = await getDb(env)
    .prepare(`SELECT * FROM ticket_links WHERE ticket_id = ? ORDER BY created_at DESC`)
    .bind(ticketId)
    .all<{
      id: string;
      connector_name: string | null;
      connector_type: string | null;
      external_id: string | null;
      external_url: string | null;
      status: string;
      error: string | null;
      created_at: string;
    }>();
  return (results ?? []).map((r) => ({
    id: r.id,
    connectorName: r.connector_name,
    connectorType: r.connector_type,
    externalId: r.external_id,
    externalUrl: r.external_url,
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* Normalisation + adapters                                                   */
/* -------------------------------------------------------------------------- */

export type NormalizedTicket = {
  ticketNumber: string;
  title: string;
  description: string;
  priority: Priority;
  severity: string;
  status: string;
  address: string;
  callerName: string;
  phone: string | null;
  source: string;
  createdAt: string;
};

function normalizeIncident(i: Incident): NormalizedTicket {
  const lines = [i.summary];
  if (i.safetyRisks.length) lines.push(`Safety risks: ${i.safetyRisks.join(", ")}`);
  if (i.crewNeeds.length) lines.push(`Crew needs: ${i.crewNeeds.join(", ")}`);
  if (i.affectedAreas.length) lines.push(`Affected areas: ${i.affectedAreas.join(", ")}`);
  lines.push(`Caller: ${i.callerName}${i.phone ? ` (${i.phone})` : ""}`);
  lines.push(`Source: ${i.source} · Rebuild Relay ${i.ticketNumber}`);
  return {
    ticketNumber: i.ticketNumber,
    title: `[${i.priority}] ${i.severity} ${i.damageType} loss — ${i.address}`,
    description: lines.join("\n"),
    priority: i.priority,
    severity: i.severity,
    status: i.status,
    address: i.address,
    callerName: i.callerName,
    phone: i.phone ?? null,
    source: i.source,
    createdAt: i.createdAt,
  };
}

type SyncResult = { externalId: string | null; externalUrl: string | null; detail: string };

const LINEAR_PRIORITY: Record<Priority, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };

function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"')]+/);
  return m ? m[0] : null;
}

async function webhookSync(config: ConnectorConfig, ticket: NormalizedTicket): Promise<SyncResult> {
  if (!config.url) throw new Error("Webhook URL is not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  const res = await fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "incident.created", ticket }),
  });
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
  const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; key?: string };
  return {
    externalId: data.id ?? data.key ?? null,
    externalUrl: data.url ?? null,
    detail: `HTTP ${res.status}`,
  };
}

async function mcpSync(config: ConnectorConfig, ticket: NormalizedTicket): Promise<SyncResult> {
  if (!config.url) throw new Error("MCP server URL is not configured");
  if (!config.toolName) throw new Error("MCP tool name is not configured");
  const headers: Record<string, string> = {};
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  const result = await mcpCallTool(config.url, headers, config.toolName, {
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    address: ticket.address,
    ticketNumber: ticket.ticketNumber,
  });
  return {
    externalId: result.text ? result.text.slice(0, 140) : null,
    externalUrl: result.text ? firstUrl(result.text) : null,
    detail: "MCP tool call ok",
  };
}

async function linearSync(config: ConnectorConfig, ticket: NormalizedTicket): Promise<SyncResult> {
  if (!config.apiKey) throw new Error("Linear API key is not configured");
  if (!config.teamId) throw new Error("Linear team ID is not configured");
  const query = `mutation Create($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { id identifier url } }
  }`;
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: config.apiKey },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          teamId: config.teamId,
          title: ticket.title,
          description: ticket.description,
          priority: LINEAR_PRIORITY[ticket.priority],
        },
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { issueCreate?: { success?: boolean; issue?: { id: string; identifier: string; url: string } } };
    errors?: Array<{ message?: string }>;
  };
  if (data.errors?.length) throw new Error(`Linear: ${data.errors[0]?.message ?? "error"}`);
  const issue = data.data?.issueCreate?.issue;
  if (!issue) throw new Error("Linear did not return an issue");
  return { externalId: issue.identifier, externalUrl: issue.url, detail: `Created ${issue.identifier}` };
}

async function runSync(connector: Connector, ticket: NormalizedTicket): Promise<SyncResult> {
  switch (connector.type) {
    case "webhook":
      return webhookSync(connector.config, ticket);
    case "mcp":
      return mcpSync(connector.config, ticket);
    case "linear":
      return linearSync(connector.config, ticket);
    default:
      throw new Error(`Unknown connector type: ${connector.type}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Public: test + sync                                                        */
/* -------------------------------------------------------------------------- */

export async function testConnector(
  env: CloudflareEnv,
  baseConnector: Connector,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const connector = await ensureFreshToken(env, baseConnector);
    let detail = "Connection ok";
    if (connector.type === "mcp") {
      if (!connector.config.url) throw new Error("MCP server URL is not configured");
      const headers: Record<string, string> = {};
      if (connector.config.token) headers["Authorization"] = `Bearer ${connector.config.token}`;
      const tools = await mcpListTools(connector.config.url, headers);
      const names = tools.map((t) => t.name);
      if (connector.config.toolName && !names.includes(connector.config.toolName)) {
        throw new Error(`Tool "${connector.config.toolName}" not found. Available: ${names.join(", ") || "none"}`);
      }
      detail = `${tools.length} tool(s) available`;
    } else if (connector.type === "linear") {
      if (!connector.config.apiKey) throw new Error("Linear API key is not configured");
      const res = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: connector.config.apiKey },
        body: JSON.stringify({ query: "{ viewer { id name } }" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: { viewer?: { name?: string } };
        errors?: Array<{ message?: string }>;
      };
      if (data.errors?.length) throw new Error(data.errors[0]?.message ?? "Linear auth failed");
      detail = `Authenticated as ${data.data?.viewer?.name ?? "Linear user"}`;
    } else if (connector.type === "webhook") {
      if (!connector.config.url) throw new Error("Webhook URL is not configured");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (connector.config.token) headers["Authorization"] = `Bearer ${connector.config.token}`;
      const res = await fetch(connector.config.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: "connection.test", message: "Rebuild Relay connection test" }),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
      detail = `HTTP ${res.status}`;
    }
    await setConnectorStatus(env, baseConnector.id, "ok", detail);
    return { ok: true, detail };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Test failed";
    await setConnectorStatus(env, baseConnector.id, "error", detail);
    return { ok: false, detail };
  }
}

export type SyncOutcome = { synced: number; failed: number };

/** Fan a new incident out to every enabled external ticketing connector. */
export async function syncIncidentToConnectors(env: CloudflareEnv, incident: Incident): Promise<SyncOutcome> {
  const connectors = (await listConnectors(env)).filter((c) => c.enabled);
  if (connectors.length === 0) return { synced: 0, failed: 0 };

  const ticket = normalizeIncident(incident);
  let synced = 0;
  let failed = 0;

  for (const baseConnector of connectors) {
    let connector = baseConnector;
    try {
      connector = await ensureFreshToken(env, baseConnector);
      const out = await runSync(connector, ticket);
      synced += 1;
      await addTicketLink(env, {
        ticketId: incident.id,
        connector,
        externalId: out.externalId,
        externalUrl: out.externalUrl,
        status: "synced",
      });
      await setConnectorStatus(env, connector.id, "ok", out.detail);
      await addTicketEvent(env, {
        ticketId: incident.id,
        type: "external_sync",
        actor: "system",
        message: `${incident.ticketNumber} synced to ${connector.name}${out.externalId ? ` (${out.externalId})` : ""}`,
        metadata: { connector: connector.name, type: connector.type, externalUrl: out.externalUrl },
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "sync failed";
      await addTicketLink(env, { ticketId: incident.id, connector, status: "error", error: message });
      await setConnectorStatus(env, connector.id, "error", message);
      await addTicketEvent(env, {
        ticketId: incident.id,
        type: "external_sync",
        actor: "system",
        message: `Failed to sync ${incident.ticketNumber} to ${connector.name}: ${message}`,
        metadata: { connector: connector.name, type: connector.type, error: true },
      });
    }
  }

  return { synced, failed };
}
