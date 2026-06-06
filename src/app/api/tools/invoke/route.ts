import { NextResponse } from "next/server";

import { getEnv, readVar } from "@/lib/cf";
import { runTool } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unified tool-call endpoint. The agent posts `{ tool, arguments }` (or
 * `{ name, parameters }`) and the matching ticketing operation runs against D1,
 * emitting live activity events. Optionally protected by DISPATCH_API_KEY.
 */
export async function POST(request: Request) {
  const env = await getEnv();

  const expectedKey = readVar(env, "DISPATCH_API_KEY");
  if (expectedKey) {
    const provided =
      request.headers.get("x-api-key") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      "";
    if (provided !== expectedKey) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    tool?: string;
    name?: string;
    arguments?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    args?: Record<string, unknown>;
  };

  const tool = body.tool ?? body.name;
  const args = body.arguments ?? body.parameters ?? body.args ?? {};

  if (!tool) {
    return NextResponse.json({ ok: false, error: "Missing `tool` name." }, { status: 400 });
  }

  const result = await runTool(env, request, tool, args);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
