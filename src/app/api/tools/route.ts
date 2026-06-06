import { NextResponse } from "next/server";

import { toolCatalog } from "@/lib/tools";

export const runtime = "nodejs";

/**
 * Tool catalog endpoint. Returns the function-calling definitions the voice
 * agent uses as server tools. Useful for configuring the ElevenLabs agent and
 * for inspecting the available ticketing operations.
 */
export async function GET() {
  return NextResponse.json({ ok: true, tools: toolCatalog });
}
