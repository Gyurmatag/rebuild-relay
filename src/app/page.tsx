import { Headphones, PhoneCall, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationsDashboard } from "@/components/dashboard/operations-dashboard";
import { VoiceConsole } from "@/components/voice/voice-console";
import { getEnv, readVar } from "@/lib/cf";
import { getDispatchStats, listIncidents, listTicketEvents, type DispatchStats } from "@/lib/db";
import type { Incident, TicketEvent } from "@/lib/incident-schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  let incidents: Incident[] = [];
  let stats: DispatchStats | null = null;
  let events: TicketEvent[] = [];
  let phoneNumber = "";

  try {
    const env = await getEnv();
    phoneNumber = readVar(env, "TWILIO_PHONE_NUMBER") ?? "";
    [incidents, stats, events] = await Promise.all([
      listIncidents(env, 50),
      getDispatchStats(env),
      listTicketEvents(env, 40),
    ]);
  } catch {
    // No binding available (e.g. during build) — render an empty board.
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-sm bg-black" />
          RebuildRelay
        </div>
        <div className="hidden items-center gap-8 text-sm text-black/60 md:flex">
          <a href="#board">Incident board</a>
          <a href="#intake">Voice intake</a>
          <a href="#architecture">Architecture</a>
        </div>
        {phoneNumber ? (
          <a
            href={`tel:${phoneNumber}`}
            className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black/85"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            {phoneNumber}
          </a>
        ) : (
          <Badge className="gap-2 bg-white/80">
            <span className="h-2 w-2 rounded-full bg-[#ff7d6e]" />
            Emergency line pending setup
          </Badge>
        )}
      </nav>

      <section className="mx-auto mt-16 max-w-7xl">
        <Badge className="mb-6 gap-2 bg-white/80">
          <span className="h-2 w-2 rounded-full bg-[#ff7d6e]" />
          ElevenLabs voice AI + Twilio for restoration teams
        </Badge>
        <h1 className="max-w-4xl text-5xl font-medium leading-[0.95] tracking-[-0.05em] text-black sm:text-6xl lg:text-7xl">
          Emergency calls, rebuilt into action.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-7 text-black/65">
          Rebuild Relay turns a flood, fire, storm, or mold emergency — phoned in, texted, or spoken to the web
          agent — into a tracked incident, a dispatched crew, and a delivery-confirmed alert, all in seconds.
        </p>
      </section>

      <section id="board" className="mx-auto mt-10 max-w-7xl">
        <OperationsDashboard
          initialIncidents={incidents}
          initialStats={stats}
          initialEvents={events}
          phoneNumber={phoneNumber}
        />
      </section>

      <section id="intake" className="mx-auto mt-5 grid max-w-7xl gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Live ElevenLabs intake</CardTitle>
            <p className="text-sm leading-6 text-black/60">
              The web agent asks restoration-specific questions and logs an incident through the same pipeline as the
              phone and SMS channels.
            </p>
          </CardHeader>
          <CardContent>
            <VoiceConsole />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <Radio className="h-5 w-5" />
            <CardTitle>One pipeline, three channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-black/65">
            <div className="rounded-2xl bg-[#f8f5ef] p-4">
              <p className="font-medium text-black">Phone &amp; SMS — Twilio</p>
              <p className="mt-1">
                Inbound calls and texts hit signature-verified webhooks, get triaged, and create incidents with an
                automatic crew dispatch.
              </p>
            </div>
            <div className="rounded-2xl bg-[#f8f5ef] p-4">
              <p className="font-medium text-black">Web voice — ElevenLabs</p>
              <p className="mt-1">High-empathy conversational intake over a signed WebRTC session.</p>
            </div>
            <div className="rounded-2xl bg-black p-4 text-white">
              <p className="flex items-center gap-2 font-medium">
                <Headphones className="h-4 w-4" /> Cloudflare-native
              </p>
              <p className="mt-1 text-white/70">D1 stores every incident, message, and call; R2 keeps the audio.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="architecture" className="mx-auto my-5 max-w-7xl rounded-[2rem] border border-black/10 bg-white/70 p-6">
        <div className="grid gap-5 text-sm text-black/65 md:grid-cols-4">
          <p>
            <strong className="block text-black">Voice + telephony</strong>ElevenLabs handles web voice; Twilio carries
            real phone calls and SMS.
          </p>
          <p>
            <strong className="block text-black">Secure by default</strong>Signed webhooks and secrets stored in
            Wrangler — never in the bundle.
          </p>
          <p>
            <strong className="block text-black">Real operations</strong>D1 persists incidents, dispatch messages, and
            call summaries with delivery status.
          </p>
          <p>
            <strong className="block text-black">Deployable today</strong>OpenNext ships the full app to Cloudflare
            Workers.
          </p>
        </div>
      </section>
    </main>
  );
}
