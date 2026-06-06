import { getEnv } from "@/lib/cf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A self-contained demo MCP server that emulates Linear's issue tools over the
 * Streamable HTTP transport. It lets you demo the external-ticketing MCP
 * connector end to end without a Linear account or OAuth — connect a Rebuild
 * Relay MCP connector to this endpoint and incidents become "Linear" issues.
 *
 * For the real Linear MCP, point an MCP connector at https://mcp.linear.app/mcp
 * with a Linear API key as the bearer token instead.
 */

type JsonRpc = { jsonrpc?: string; id?: number | string; method?: string; params?: Record<string, unknown> };

const PROTOCOL_VERSION = "2025-06-18";

const TOOLS = [
  {
    name: "create_issue",
    description: "Create a Linear issue.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Issue title" },
        description: { type: "string", description: "Issue description" },
        priority: { type: "string", description: "P1–P4" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_issues",
    description: "List recent demo issues.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function nextIssueNumber(env: CloudflareEnv): Promise<number> {
  try {
    const row = await env.DB.prepare(
      `INSERT INTO counters (name, value) VALUES ('linear_demo', 101)
       ON CONFLICT(name) DO UPDATE SET value = value + 1
       RETURNING value`,
    ).first<{ value: number }>();
    return row?.value ?? 101;
  } catch {
    return 100 + Math.floor(Math.random() * 900);
  }
}

function rpcResult(id: number | string | undefined, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: number | string | undefined, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as JsonRpc;
  const { id, method, params } = body;

  // Notifications (no id) — acknowledge with no content.
  if (id === undefined || method?.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "linear-demo", version: "1.0.0" },
      });

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      const env = await getEnv();

      if (name === "create_issue") {
        const n = await nextIssueNumber(env);
        const identifier = `DEMO-${n}`;
        const url = `https://linear.app/demo/issue/${identifier}`;
        const title = (args.title as string) ?? "Untitled";
        return rpcResult(id, {
          content: [
            {
              type: "text",
              text: `Created Linear issue ${identifier}: ${title}\n${url}`,
            },
          ],
        });
      }

      if (name === "list_issues") {
        return rpcResult(id, {
          content: [{ type: "text", text: "Demo Linear workspace — issues are created on demand via create_issue." }],
        });
      }

      return rpcResult(id, { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] });
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function GET() {
  // Friendly hint for anyone opening the URL in a browser.
  return Response.json({
    server: "linear-demo (MCP, Streamable HTTP)",
    transport: "POST JSON-RPC to this URL",
    tools: TOOLS.map((t) => t.name),
  });
}
