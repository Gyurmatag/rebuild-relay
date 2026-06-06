import { NextResponse } from "next/server";

import { getEnv } from "@/lib/cf";
import { getIncident, updateIncidentStatus } from "@/lib/db";
import { incidentStatuses } from "@/lib/incident-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = await getEnv();
  const incident = await getIncident(env, id);
  if (!incident) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, incident });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = await getEnv();
  const body = (await request.json().catch(() => ({}))) as { status?: string };

  if (!body.status || !incidentStatuses.includes(body.status as never)) {
    return NextResponse.json(
      { ok: false, error: `status must be one of ${incidentStatuses.join(", ")}` },
      { status: 400 },
    );
  }

  await updateIncidentStatus(env, id, body.status as (typeof incidentStatuses)[number]);
  const incident = await getIncident(env, id);
  return NextResponse.json({ ok: true, incident });
}
