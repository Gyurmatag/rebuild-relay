import { getEnv } from "@/lib/cf";
import { saveRecording } from "@/lib/db";
import { getTwilioConfig, twilioAuthHeader, verifyTwilioRequest } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recording status callback. When the Twilio line is configured to record
 * inbound calls, this stores the recording metadata and best-effort mirrors the
 * audio into the R2 bucket so it lives alongside the incident record.
 */
export async function POST(request: Request) {
  const env = await getEnv();
  const verified = await verifyTwilioRequest(env, request);
  if (!verified.ok) {
    return new Response(verified.reason, { status: verified.status });
  }

  const params = verified.params;
  const recordingSid = params.RecordingSid;
  const recordingUrl = params.RecordingUrl;
  const callSid = params.CallSid || null;
  const duration = params.RecordingDuration ? Number(params.RecordingDuration) : null;

  if (!recordingSid) {
    return new Response(null, { status: 204 });
  }

  let r2Key: string | null = null;
  const config = getTwilioConfig(env);
  const bucket = env.AUDIO_BUCKET;

  if (recordingUrl && bucket && config) {
    try {
      const audioResponse = await fetch(`${recordingUrl}.mp3`, {
        headers: { Authorization: twilioAuthHeader(config) },
      });
      if (audioResponse.ok) {
        r2Key = `recordings/${recordingSid}.mp3`;
        await bucket.put(r2Key, audioResponse.body, {
          httpMetadata: { contentType: "audio/mpeg" },
        });
      }
    } catch (error) {
      console.error("Failed to mirror recording to R2", error);
      r2Key = null;
    }
  }

  await saveRecording(env, {
    recordingSid,
    callSid,
    durationSeconds: duration,
    r2Key,
    sourceUrl: recordingUrl || null,
  }).catch((error) => console.error("Failed to save recording metadata", error));

  return new Response(null, { status: 204 });
}
