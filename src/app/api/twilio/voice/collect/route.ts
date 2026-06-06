import { getEnv, resolveBaseUrl } from "@/lib/cf";
import { createIncident } from "@/lib/db";
import { classifyDamage, classifySeverity } from "@/lib/triage";
import { dispatchIncident, escapeXml, twimlResponse, verifyTwilioRequest } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handles the spoken description captured by the voice `<Gather>`: classifies
 * the loss, creates a tracked incident sourced from the phone channel, fans out
 * the crew dispatch, and reads a confirmation back to the caller.
 */
export async function POST(request: Request) {
  const env = await getEnv();
  const verified = await verifyTwilioRequest(env, request);
  if (!verified.ok) {
    return new Response(verified.reason, { status: verified.status });
  }

  const params = verified.params;
  const speech = (params.SpeechResult ?? "").trim();
  const fromNumber = params.From || undefined;
  const baseUrl = resolveBaseUrl(request, env);

  if (!speech) {
    return twimlResponse(
      `<Say voice="Polly.Joanna">Sorry, we could not understand the description. Please call back. Goodbye.</Say><Hangup/>`,
    );
  }

  const incident = await createIncident(env, {
    callerName: fromNumber ? `Caller ${fromNumber}` : "Phone caller",
    phone: fromNumber,
    address: "Address captured by voice — confirm on callback",
    damageType: classifyDamage(speech),
    severity: classifySeverity(speech),
    summary: speech,
    source: "phone",
  });

  await dispatchIncident(env, incident, baseUrl).catch((error) => {
    console.error("Voice dispatch failed", error);
  });

  const confirmation = escapeXml(
    `Thank you. We have logged a ${incident.severity} ${incident.damageType} emergency and are dispatching a mitigation crew now. If you are in immediate danger, hang up and call 9 1 1. Goodbye.`,
  );

  return twimlResponse(`<Say voice="Polly.Joanna">${confirmation}</Say><Hangup/>`);
}
