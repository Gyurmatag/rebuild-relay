import type { Metadata } from "next";
import { Headphones } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceConsole } from "@/components/voice/voice-console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Voice intake — Rebuild Relay" };

export default function IntakePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">Voice intake</h1>
        <p className="mt-1 text-sm text-black/55">
          Talk to the ElevenLabs agent. It asks restoration-specific questions and drives the ticketing system through
          tool calls — watch the Tickets and Activity pages update live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.85fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Live ElevenLabs intake</CardTitle>
            <p className="text-sm leading-6 text-black/60">
              The same pipeline as the phone and SMS channels — every action is persisted in D1 and streamed to the
              board.
            </p>
          </CardHeader>
          <CardContent>
            <VoiceConsole />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" /> What the agent can do
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-black/65">
            {[
              ["create_incident", "Open a prioritized ticket from the caller's report and dispatch the crew."],
              ["update_incident", "Escalate severity or add a safety risk as new facts emerge."],
              ["dispatch_crew", "Send (or re-send) the on-call crew alert."],
              ["assign_ticket", "Assign a responder or crew lead."],
              ["add_note", "Append a note to the ticket audit trail."],
              ["lookup_incident", "Look up a ticket or recent tickets for repeat callers."],
            ].map(([tool, desc]) => (
              <div key={tool} className="rounded-2xl bg-[#f8f5ef] p-3">
                <p className="font-mono text-xs font-semibold text-[#7f73ff]">{tool}</p>
                <p className="mt-1">{desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
