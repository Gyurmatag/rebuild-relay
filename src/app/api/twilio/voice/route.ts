import { getEnv, resolveBaseUrl } from "@/lib/cf";
import { escapeXml, twimlResponse, verifyTwilioRequest } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound call entry point for the emergency line. Greets the caller and opens
 * a speech `<Gather>` whose result is posted to the collect handler, which
 * turns the description into a tracked incident and dispatches a crew.
 */
export async function POST(request: Request) {
  const env = await getEnv();
  const verified = await verifyTwilioRequest(env, request);
  if (!verified.ok) {
    return new Response(verified.reason, { status: verified.status });
  }

  const baseUrl = resolveBaseUrl(request, env);
  const action = escapeXml(`${baseUrl}/api/twilio/voice/collect`);

  const inner = `
    <Say voice="Polly.Joanna">You have reached Rebuild Relay emergency restoration intake.</Say>
    <Gather input="speech" action="${action}" method="POST" speechTimeout="auto" speechModel="phone_call" language="en-US">
      <Say voice="Polly.Joanna">After the tone, describe the emergency, the property address, and any safety hazards such as water near electrical, gas, or structural damage.</Say>
    </Gather>
    <Say voice="Polly.Joanna">We did not receive a description. Please call back so we can dispatch help. Goodbye.</Say>
  `;

  return twimlResponse(inner);
}
