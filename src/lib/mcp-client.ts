/**
 * Minimal MCP (Model Context Protocol) client over the Streamable HTTP
 * transport — enough to connect to a remote ticketing MCP server, list its
 * tools, and call one. Runs on the Workers runtime (fetch + Web APIs only).
 *
 * Flow per the MCP spec: POST `initialize`, capture the `Mcp-Session-Id`
 * header, send the `notifications/initialized` notification, then issue the
 * real request. Responses may be JSON or an SSE stream; both are parsed.
 */

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code?: number; message?: string };
};

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    ...extra,
  };
}

async function parseResponse(res: Response, id: number): Promise<JsonRpcResponse> {
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as JsonRpcResponse;
  }

  // SSE framing: collect `data:` payloads and find the matching JSON-RPC reply.
  const blocks = text.split(/\n\n/);
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!data) continue;
    try {
      const json = JSON.parse(data) as JsonRpcResponse;
      if (json.id === id || json.result !== undefined || json.error !== undefined) return json;
    } catch {
      // not this frame
    }
  }
  // Last resort: try to parse the whole body.
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    throw new Error(`Unparseable MCP response (HTTP ${res.status})`);
  }
}

async function initialize(url: string, headers: Record<string, string>): Promise<string | undefined> {
  const res = await fetch(url, {
    method: "POST",
    headers: baseHeaders(headers),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "rebuild-relay", version: "1.0.0" },
      },
    }),
  });

  const sessionId = res.headers.get("mcp-session-id") ?? undefined;
  const json = await parseResponse(res, 1);
  if (json.error) throw new Error(`MCP initialize failed: ${json.error.message ?? "error"}`);

  // Best-effort "initialized" notification (no response expected).
  await fetch(url, {
    method: "POST",
    headers: baseHeaders(sessionId ? { ...headers, "Mcp-Session-Id": sessionId } : headers),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => {});

  return sessionId;
}

export type McpTool = { name: string; description?: string };

export async function mcpListTools(url: string, headers: Record<string, string> = {}): Promise<McpTool[]> {
  const sessionId = await initialize(url, headers);
  const res = await fetch(url, {
    method: "POST",
    headers: baseHeaders(sessionId ? { ...headers, "Mcp-Session-Id": sessionId } : headers),
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  });
  const json = await parseResponse(res, 2);
  if (json.error) throw new Error(`MCP tools/list failed: ${json.error.message ?? "error"}`);
  const tools = (json.result as { tools?: McpTool[] })?.tools ?? [];
  return tools;
}

export type McpCallResult = { text: string; raw: unknown };

export async function mcpCallTool(
  url: string,
  headers: Record<string, string>,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  const sessionId = await initialize(url, headers);
  const res = await fetch(url, {
    method: "POST",
    headers: baseHeaders(sessionId ? { ...headers, "Mcp-Session-Id": sessionId } : headers),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });
  const json = await parseResponse(res, 2);
  if (json.error) throw new Error(`MCP tools/call failed: ${json.error.message ?? "error"}`);

  const result = json.result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
  if (result?.isError) {
    const msg = (result.content ?? []).map((c) => c.text).filter(Boolean).join(" ");
    throw new Error(`MCP tool returned an error: ${msg || "unknown"}`);
  }
  const text = (result?.content ?? [])
    .map((c) => c.text)
    .filter(Boolean)
    .join(" ")
    .trim();
  return { text, raw: json.result };
}
