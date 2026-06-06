import { NextResponse } from "next/server";

import { getEnv } from "@/lib/cf";
import { recordCallSummary } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * ElevenLabs post-call webhook. ElevenLabs wraps the payload as
 * `{ type, event_timestamp, data }`; we accept both the wrapped and flat shapes
 * and persist the conversation summary to D1.
 */
export async function POST(request: Request) {
  const raw = (await request.json().catch(() => ({}))) as
    | PostCallPayload
    | { data?: PostCallPayload };

  const payload: PostCallPayload =
    "data" in raw && raw.data ? (raw.data as PostCallPayload) : (raw as PostCallPayload);

  const conversationId = payload.conversation_id ?? `conv_${crypto.randomUUID()}`;

  const summary = {
    conversationId,
    agentName: payload.agent_name ?? "Rebuild Relay",
    status: payload.status ?? "received",
    durationSeconds: payload.metadata?.call_duration_secs ?? null,
    summary: payload.analysis?.transcript_summary ?? "Post-call summary received.",
    payload,
  };

  try {
    const env = await getEnv();
    await recordCallSummary(env, summary);
  } catch (error) {
    // Acknowledge the webhook even if persistence fails so ElevenLabs does not
    // retry indefinitely; the error is surfaced in Workers logs/observability.
    console.error("Failed to persist post-call summary", error);
  }

  return NextResponse.json({
    ok: true,
    conversationId,
    summary: summary.summary,
    collected: payload.analysis?.data_collection_results ?? {},
  });
}
