import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PostCallPayload = {
  conversation_id?: string;
  agent_name?: string;
  status?: string;
  analysis?: {
    transcript_summary?: string;
    data_collection_results?: Record<string, unknown>;
  };
  metadata?: {
    call_duration_secs?: number;
    cost?: number;
  };
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as PostCallPayload;

  return NextResponse.json({
    ok: true,
    conversationId: payload.conversation_id ?? "demo-conversation",
    agentName: payload.agent_name ?? "Rebuild Relay",
    status: payload.status ?? "received",
    summary: payload.analysis?.transcript_summary ?? "Post-call summary received.",
    duration: payload.metadata?.call_duration_secs ?? null,
    collected: payload.analysis?.data_collection_results ?? {},
  });
}
