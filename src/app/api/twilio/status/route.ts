import { getEnv } from "@/lib/cf";
import { updateNotificationStatusBySid } from "@/lib/db";
import { verifyTwilioRequest } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delivery status callback for outbound messages (and calls). Twilio POSTs at
 * each state transition (queued -> sent -> delivered / failed). We update the
 * matching notification row by its Twilio SID. Returns 204 with no body.
 */
export async function POST(request: Request) {
  const env = await getEnv();
  const verified = await verifyTwilioRequest(env, request);
  if (!verified.ok) {
    return new Response(verified.reason, { status: verified.status });
  }

  const params = verified.params;
  const sid = params.MessageSid || params.CallSid || params.SmsSid;
  const status = params.MessageStatus || params.CallStatus || params.SmsStatus;
  const errorCode = params.ErrorCode || null;

  if (sid && status) {
    await updateNotificationStatusBySid(env, sid, status, errorCode).catch((error) => {
      console.error("Failed to update notification status", error);
    });
  }

  return new Response(null, { status: 204 });
}
