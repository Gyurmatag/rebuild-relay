import { NextResponse } from "next/server";

import { getEnv } from "@/lib/cf";
import { getConnector, testConnector } from "@/lib/connectors";
import { getSessionFromRequest } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const env = await getEnv();
  if (!(await getSessionFromRequest(env, request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const connector = await getConnector(env, id);
  if (!connector) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const result = await testConnector(env, connector);
  return NextResponse.json(result);
}
