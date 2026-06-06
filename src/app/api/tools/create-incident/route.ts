import { NextResponse } from "next/server";

import { getEnv, readVar, resolveBaseUrl } from "@/lib/cf";
import { createIncident } from "@/lib/db";
import { dispatchIncident } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Canonical incident-creation endpoint. Called by:
 *  - the ElevenLabs agent as a server tool while the caller is still talking,
 *  - the operations dashboard when an operator logs an incident manually.
 *
 * Persists to D1 and fans out a Twilio SMS dispatch to the on-call crew.
 */
export async function POST(request: Request) {
  const env = await getEnv();

  // Optional shared-secret protection for the public tool endpoint.
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

  const payload = await request.json().catch(() => ({}));

  let incident;
  try {
    incident = await createIncident(env, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create incident.";
    return new NextResponse(message, { status: 400 });
  }

  const dispatch = await dispatchIncident(env, incident, resolveBaseUrl(request, env)).catch((error) => ({
    attempted: true,
    sent: 0,
    failures: [{ to: "*", error: error instanceof Error ? error.message : "dispatch failed" }],
  }));

  return NextResponse.json({
    ok: true,
    incident,
    dispatch,
    dispatchMessage: `${incident.severity.toUpperCase()} ${incident.damageType} loss at ${incident.address}. ${incident.summary}`,
  });
}
