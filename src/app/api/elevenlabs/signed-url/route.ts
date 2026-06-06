import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return new NextResponse("Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID. Configure them as Wrangler secrets.", {
      status: 503,
    });
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    {
      headers: {
        "xi-api-key": apiKey,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    return new NextResponse(`ElevenLabs signed URL request failed: ${body}`, { status: response.status });
  }

  const body = (await response.json()) as { signed_url?: string };
  if (!body.signed_url) {
    return new NextResponse("ElevenLabs response did not include signed_url.", { status: 502 });
  }

  return NextResponse.json({ signedUrl: body.signed_url });
}
