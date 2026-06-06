import { NextResponse } from "next/server";

import { getEnv } from "@/lib/cf";
import { getDispatchStats, listIncidents } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = await getEnv();
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "50");

  try {
    const [incidents, stats] = await Promise.all([
      listIncidents(env, Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50),
      getDispatchStats(env),
    ]);
    return NextResponse.json({ ok: true, incidents, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load incidents.";
    return NextResponse.json({ ok: false, error: message, incidents: [], stats: null }, { status: 500 });
  }
}
