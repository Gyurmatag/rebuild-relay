import { NextResponse } from "next/server";

import { getEnv } from "@/lib/cf";
import { deleteConnector, getConnector, redactConnector, setConnectorEnabled } from "@/lib/connectors";
import { getSessionFromRequest } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const env = await getEnv();
  if (!(await getSessionFromRequest(env, request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled === "boolean") {
    await setConnectorEnabled(env, id, body.enabled);
  }
  const connector = await getConnector(env, id);
  if (!connector) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, connector: redactConnector(connector) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const env = await getEnv();
  if (!(await getSessionFromRequest(env, request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteConnector(env, id);
  return NextResponse.json({ ok: true });
}
