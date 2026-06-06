import { AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardList, Headphones, Radio, ShieldCheck, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceConsole } from "@/components/voice/voice-console";
import { demoIncident } from "@/lib/incident-schema";

const stages = ["Intake", "Triage", "Dispatch", "Adjuster packet"];

const transcript = [
  { speaker: "Caller", text: "A pipe burst upstairs. Water is coming through the kitchen ceiling." },
  { speaker: "Relay", text: "Is anyone in immediate danger, and is water close to outlets or electrical panels?" },
  { speaker: "Caller", text: "Yes, it is running down the wall near two outlets. The tenant is elderly." },
  { speaker: "Relay", text: "I am marking this critical and preparing a mitigation crew brief now." },
];

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-sm bg-black" />
          RebuildRelay
        </div>
        <div className="hidden items-center gap-8 text-sm text-black/60 md:flex">
          <a href="#demo">Voice demo</a>
          <a href="#packet">Dispatch packet</a>
          <a href="#architecture">Architecture</a>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          Hackathon build
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </nav>

      <section className="mx-auto mt-20 grid max-w-7xl gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:items-end">
        <div>
          <Badge className="mb-7 gap-2 bg-white/80">
            <span className="h-2 w-2 rounded-full bg-[#ff7d6e]" />
            ElevenLabs voice AI for restoration teams
          </Badge>
          <h1 className="max-w-3xl text-6xl font-medium leading-[0.92] tracking-[-0.055em] text-black sm:text-7xl lg:text-8xl">
            Emergency calls, rebuilt into action.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-7 text-black/65">
            Rebuild Relay turns a chaotic flood, fire, storm, or mold call into a live incident board,
            adjuster-ready summary, and contractor voice brief while the caller is still talking.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="gap-2">
              <Radio className="h-4 w-4" />
              Run the 3-minute demo
            </Button>
            <Button variant="outline" size="lg">
              View dispatch packet
            </Button>
          </div>
        </div>

        <div className="rounded-[2.4rem] border border-black/10 bg-white/45 p-2 shadow-[0_34px_120px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="grid grid-cols-3 gap-2 rounded-t-[2rem] border-b border-black/10 bg-[#f0eee9] p-2 text-center text-sm">
            <div className="rounded-full bg-white py-2 shadow-sm">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#ff8a5c]" />
              ElevenVoice
            </div>
            <div className="py-2 text-black/55">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#51a7a0]" />
              RebuildOps
            </div>
            <div className="py-2 text-black/55">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#969696]" />
              Cloudflare
            </div>
          </div>
          <div className="grid min-h-[340px] place-items-center overflow-hidden rounded-b-[2rem] bg-[#f8f5ef] p-8">
            <div className="flex w-full items-end justify-around gap-6">
              <div className="orb h-24 w-24 bg-[radial-gradient(circle_at_30%_20%,#fff_0,#ffe3eb_28%,#ff9aa5_100%)] opacity-80" />
              <div className="orb h-44 w-44 bg-[radial-gradient(circle_at_28%_18%,#fff_0,#8377ff_35%,#ffb789_100%)]" />
              <div className="orb grid h-56 w-56 place-items-center bg-[radial-gradient(circle_at_32%_22%,#fff_0,#ff7381_25%,#8f83ff_50%,#a4b879_100%)]">
                <div className="relative z-10 grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-xl">
                  <Headphones className="h-7 w-7" />
                </div>
              </div>
              <div className="orb h-44 w-44 bg-[radial-gradient(circle_at_35%_15%,#fff_0,#9fb574_45%,#ff9b6c_100%)]" />
              <div className="orb h-24 w-24 bg-[radial-gradient(circle_at_30%_20%,#fff_0,#ffcbc2_36%,#ffa07e_100%)] opacity-80" />
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="mx-auto mt-16 grid max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Live ElevenLabs intake</CardTitle>
            <p className="text-sm leading-6 text-black/60">
              The agent asks restoration-specific questions, updates the UI through tools, and prepares the crew brief.
            </p>
          </CardHeader>
          <CardContent>
            <VoiceConsole />
          </CardContent>
        </Card>

        <Card id="packet" className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Critical incident packet</CardTitle>
              <p className="mt-2 text-sm text-black/60">{demoIncident.address}</p>
            </div>
            <Badge className="border-red-200 bg-red-50 text-red-700">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              {demoIncident.severity}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              {stages.map((stage) => (
                <div key={stage} className="rounded-2xl border border-black/10 bg-[#f8f5ef] p-4">
                  <CheckCircle2 className="mb-5 h-5 w-5 text-[#4e8f63]" />
                  <p className="text-sm font-medium">{stage}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.5rem] bg-black p-5 text-white">
              <p className="text-sm text-white/55">Contractor audio brief</p>
              <p className="mt-3 text-lg leading-7">{demoIncident.summary}</p>
              <div className="mt-5 h-10 rounded-full bg-white/10 p-2">
                <div className="voice-wave h-full rounded-full opacity-60 invert" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto mt-5 grid max-w-7xl gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Safety risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoIncident.safetyRisks.map((risk) => (
              <p key={risk} className="rounded-2xl bg-[#f8f5ef] px-4 py-3 text-sm">{risk}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Truck className="h-5 w-5" />
            <CardTitle>Crew needs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoIncident.crewNeeds.map((need) => (
              <p key={need} className="rounded-2xl bg-[#f8f5ef] px-4 py-3 text-sm">{need}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <ClipboardList className="h-5 w-5" />
            <CardTitle>Live transcript</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transcript.map((line) => (
              <div key={line.text} className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-xs font-medium text-black/45">{line.speaker}</p>
                <p className="mt-1 text-sm leading-5">{line.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="architecture" className="mx-auto my-5 max-w-7xl rounded-[2rem] border border-black/10 bg-white/70 p-6">
        <div className="grid gap-5 text-sm text-black/65 md:grid-cols-4">
          <p><strong className="block text-black">Voice-native</strong>ElevenLabs handles the high-empathy caller interaction.</p>
          <p><strong className="block text-black">Secure by default</strong>API keys stay in Wrangler secrets behind signed URLs.</p>
          <p><strong className="block text-black">Real operations</strong>D1 stores incident packets and webhook summaries.</p>
          <p><strong className="block text-black">Deployable today</strong>OpenNext ships the full app to Cloudflare Workers.</p>
        </div>
      </section>
    </main>
  );
}
