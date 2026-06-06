import { getEnv, resolveBaseUrl } from "@/lib/cf";
import { addTicketEvent, createIncident, logNotification } from "@/lib/db";
import { classifyDamage, classifySeverity } from "@/lib/triage";
import { dispatchIncident, escapeXml, twimlResponse, verifyTwilioRequest } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound SMS to the emergency line. Logs the message, creates an incident from
 * the text, dispatches the crew, and replies to the texter with confirmation.
 */
export async function POST(request: Request) {
  const env = await getEnv();
  const verified = await verifyTwilioRequest(env, request);
  if (!verified.ok) {
    return new Response(verified.reason, { status: verified.status });
  }

  const params = verified.params;
  const body = (params.Body ?? "").trim();
  const fromNumber = params.From || undefined;
  const toNumber = params.To || undefined;
  const baseUrl = resolveBaseUrl(request, env);

  if (!body) {
    return twimlResponse(
      `<Message>Please reply with a short description of the emergency and the property address so we can dispatch a crew.</Message>`,
    );
  }

  const incident = await createIncident(env, {
    callerName: fromNumber ? `Texter ${fromNumber}` : "SMS caller",
    phone: fromNumber,
    address: "Address pending — replied via SMS",
    damageType: classifyDamage(body),
    severity: classifySeverity(body),
    summary: body,
    source: "sms",
  });

  await logNotification(env, {
    incidentId: incident.id,
    channel: "sms",
    direction: "inbound",
    toNumber,
    fromNumber,
    body,
    twilioSid: params.MessageSid ?? null,
    status: "received",
  });

  await addTicketEvent(env, {
    ticketId: incident.id,
    type: "inbound_sms",
    actor: "caller",
    message: `Inbound SMS from ${fromNumber ?? "unknown"}: "${body.slice(0, 120)}"`,
    metadata: { from: fromNumber },
  });

  await dispatchIncident(env, incident, baseUrl).catch((error) => {
    console.error("SMS dispatch failed", error);
  });

  const reply = escapeXml(
    `RebuildRelay received your ${incident.severity} ${incident.damageType} emergency. A mitigation crew is being dispatched. Reply with the property address if you have not shared it. If you are in danger, call 911.`,
  );

  return twimlResponse(`<Message>${reply}</Message>`);
}
