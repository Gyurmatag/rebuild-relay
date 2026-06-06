import { NextResponse } from "next/server";

import { incidentSchema } from "@/lib/incident-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const incident = incidentSchema.parse(payload);

  // This route is intentionally deployable without D1 during the hackathon demo.
  // Once the D1 binding is active, persist `incident` here with env.DB.prepare(...).
  return NextResponse.json({
    ok: true,
    incident,
    dispatchMessage: `Critical ${incident.damageType} loss at ${incident.address}. ${incident.summary}`,
  });
}
