import { NextResponse } from "next/server";

import { getEnv } from "@/lib/cf";
import {
  type ConnectorType,
  connectorTypes,
  createConnector,
  listConnectors,
  redactConnector,
} from "@/lib/connectors";
import { getSessionFromRequest } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = await getEnv();
  if (!(await getSessionFromRequest(env, request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const connectors = (await listConnectors(env)).map(redactConnector);
  return NextResponse.json({ ok: true, connectors });
}

export async function POST(request: Request) {
  const env = await getEnv();
  if (!(await getSessionFromRequest(env, request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    type?: string;
    config?: Record<string, string>;
  };

  const name = (body.name ?? "").trim();
  const type = body.type as ConnectorType;
  const config = body.config ?? {};

  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  if (!connectorTypes.includes(type)) {
    return NextResponse.json({ ok: false, error: `type must be one of ${connectorTypes.join(", ")}` }, { status: 400 });
  }

  // Drop empty values so we don't overwrite anything with blanks.
  const cleanConfig: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.trim()) cleanConfig[key] = value.trim();
  }

  const connector = await createConnector(env, { name, type, config: cleanConfig });
  return NextResponse.json({ ok: true, connector: redactConnector(connector) });
}
