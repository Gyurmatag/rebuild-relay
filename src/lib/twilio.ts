import { readVar } from "@/lib/cf";
import { logNotification, updateNotificationStatusBySid } from "@/lib/db";
import type { Incident } from "@/lib/incident-schema";
import { escapeXml, validateTwilioFormSignature } from "@/lib/twilio-sign";

export { escapeXml, validateTwilioFormSignature };

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  /** Either a phone number or a Messaging Service is required to send. */
  fromNumber?: string;
  messagingServiceSid?: string;
  /** On-call crew / adjuster numbers that receive dispatch alerts. */
  dispatchNumbers: string[];
};

export function getTwilioConfig(env: CloudflareEnv): TwilioConfig | null {
  const accountSid = readVar(env, "TWILIO_ACCOUNT_SID");
  const authToken = readVar(env, "TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) return null;

  return {
    accountSid,
    authToken,
    fromNumber: readVar(env, "TWILIO_PHONE_NUMBER"),
    messagingServiceSid: readVar(env, "TWILIO_MESSAGING_SERVICE_SID"),
    dispatchNumbers: (readVar(env, "DISPATCH_NUMBERS") ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean),
  };
}

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

function authHeader(config: TwilioConfig): string {
  return `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`;
}

export type SendSmsResult = {
  sid: string;
  status: string;
};

export async function sendSms(
  config: TwilioConfig,
  params: { to: string; body: string; statusCallback?: string },
): Promise<SendSmsResult> {
  const form = new URLSearchParams();
  form.set("To", params.to);
  form.set("Body", params.body);
  if (config.messagingServiceSid) {
    form.set("MessagingServiceSid", config.messagingServiceSid);
  } else if (config.fromNumber) {
    form.set("From", config.fromNumber);
  } else {
    throw new Error("Twilio sender not configured: set TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID.");
  }
  if (params.statusCallback) form.set("StatusCallback", params.statusCallback);

  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = (await response.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
    code?: number;
  };

  if (!response.ok || !data.sid) {
    throw new Error(`Twilio SMS send failed (${response.status}): ${data.message ?? "unknown error"}`);
  }

  return { sid: data.sid, status: data.status ?? "queued" };
}

export async function placeCall(
  config: TwilioConfig,
  params: { to: string; twiml: string; statusCallback?: string },
): Promise<{ sid: string; status: string }> {
  if (!config.fromNumber) {
    throw new Error("Twilio voice sender not configured: set TWILIO_PHONE_NUMBER.");
  }
  const form = new URLSearchParams();
  form.set("To", params.to);
  form.set("From", config.fromNumber);
  form.set("Twiml", params.twiml);
  if (params.statusCallback) form.set("StatusCallback", params.statusCallback);

  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${config.accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = (await response.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
  };
  if (!response.ok || !data.sid) {
    throw new Error(`Twilio call failed (${response.status}): ${data.message ?? "unknown error"}`);
  }
  return { sid: data.sid, status: data.status ?? "queued" };
}

/* -------------------------------------------------------------------------- */
/* Webhook signature validation + parsing.                                    */
/* The HMAC-SHA1 algorithm lives in twilio-sign.ts (pure, runtime-only).      */
/* -------------------------------------------------------------------------- */

/** Parse a form-encoded Twilio webhook body into a plain object. */
export async function readTwilioForm(request: Request): Promise<Record<string, string>> {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = typeof value === "string" ? value : "";
  }
  return params;
}

export type VerifiedTwilioRequest =
  | { ok: true; params: Record<string, string> }
  | { ok: false; status: number; reason: string; params?: Record<string, string> };

/**
 * Read and authenticate an inbound Twilio webhook. Reads the form body once and
 * validates the `X-Twilio-Signature` against the configured auth token. Tries
 * both the raw request URL and a PUBLIC_BASE_URL-derived URL so it works behind
 * proxies that rewrite the host.
 */
export async function verifyTwilioRequest(
  env: CloudflareEnv,
  request: Request,
): Promise<VerifiedTwilioRequest> {
  // Read the body once. The skip flag is a local-dev escape hatch and must
  // bypass the auth-token check too, so it is honored before anything else.
  const params = await readTwilioForm(request);
  if (readVar(env, "TWILIO_SKIP_VALIDATION") === "1") {
    return { ok: true, params };
  }

  const authToken = readVar(env, "TWILIO_AUTH_TOKEN");
  if (!authToken) {
    return { ok: false, status: 503, reason: "TWILIO_AUTH_TOKEN is not configured.", params };
  }

  const signature = request.headers.get("X-Twilio-Signature") ?? "";

  const requestUrl = new URL(request.url);
  const candidateUrls = new Set<string>([request.url]);
  const publicBase = readVar(env, "PUBLIC_BASE_URL");
  if (publicBase) {
    candidateUrls.add(`${publicBase.replace(/\/$/, "")}${requestUrl.pathname}${requestUrl.search}`);
  }

  for (const url of candidateUrls) {
    if (await validateTwilioFormSignature(authToken, url, params, signature)) {
      return { ok: true, params };
    }
  }

  return { ok: false, status: 403, reason: "Invalid Twilio signature.", params };
}

/* -------------------------------------------------------------------------- */
/* TwiML builders                                                             */
/* -------------------------------------------------------------------------- */

export function twimlResponse(inner: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

/* -------------------------------------------------------------------------- */
/* High-level dispatch: notify on-call crew + caller about a new incident.    */
/* -------------------------------------------------------------------------- */

export function buildDispatchMessage(incident: Incident): string {
  const lines = [
    `RebuildRelay ${incident.severity.toUpperCase()} ${incident.damageType} loss`,
    incident.address,
    incident.summary,
  ];
  if (incident.safetyRisks.length) {
    lines.push(`Safety: ${incident.safetyRisks.join("; ")}`);
  }
  if (incident.crewNeeds.length) {
    lines.push(`Crew: ${incident.crewNeeds.join("; ")}`);
  }
  if (incident.phone) {
    lines.push(`Caller: ${incident.callerName} ${incident.phone}`);
  }
  // SMS segments are billed per 160 chars; keep dispatch concise.
  return lines.join("\n").slice(0, 1500);
}

export type DispatchOutcome = {
  attempted: boolean;
  sent: number;
  failures: { to: string; error: string }[];
};

/**
 * Send the dispatch brief to every on-call number and, when we have one, a
 * short acknowledgement to the caller. Each send is logged to D1 with its
 * Twilio SID so the status webhook can track delivery.
 */
export async function dispatchIncident(
  env: CloudflareEnv,
  incident: Incident,
  baseUrl: string,
): Promise<DispatchOutcome> {
  const config = getTwilioConfig(env);
  if (!config || config.dispatchNumbers.length === 0) {
    return { attempted: false, sent: 0, failures: [] };
  }

  const body = buildDispatchMessage(incident);
  const statusCallback = `${baseUrl}/api/twilio/status`;
  const failures: { to: string; error: string }[] = [];
  let sent = 0;

  for (const to of config.dispatchNumbers) {
    try {
      const result = await sendSms(config, { to, body, statusCallback });
      sent += 1;
      await logNotification(env, {
        incidentId: incident.id,
        channel: "sms",
        direction: "outbound",
        toNumber: to,
        fromNumber: config.fromNumber ?? config.messagingServiceSid ?? null,
        body,
        twilioSid: result.sid,
        status: result.status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      failures.push({ to, error: message });
      await logNotification(env, {
        incidentId: incident.id,
        channel: "sms",
        direction: "outbound",
        toNumber: to,
        body,
        status: "failed",
        errorCode: message,
      });
    }
  }

  // Reassure the caller (only for inbound/known numbers) that help is coming.
  if (incident.phone && incident.source !== "sms") {
    try {
      const ack = `RebuildRelay received your ${incident.damageType} emergency at ${incident.address}. A mitigation crew is being dispatched now.`;
      const result = await sendSms(config, { to: incident.phone, body: ack, statusCallback });
      await logNotification(env, {
        incidentId: incident.id,
        channel: "sms",
        direction: "outbound",
        toNumber: incident.phone,
        body: ack,
        twilioSid: result.sid,
        status: result.status,
      });
    } catch {
      // Caller ack is best-effort; never block dispatch on it.
    }
  }

  return { attempted: true, sent, failures };
}

export { updateNotificationStatusBySid };
