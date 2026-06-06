"use client";

import Link from "next/link";
import { ArrowUpRight, Radio } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { StatCards } from "@/components/dashboard/stat-cards";
import { TicketQueue } from "@/components/dashboard/ticket-queue";

export function OverviewView() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="max-w-3xl text-4xl font-medium leading-[0.98] tracking-[-0.04em] text-black sm:text-5xl">
          Operations console
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/60">
          Every flood, fire, storm, or mold emergency — phoned in, texted, or spoken to the web agent — becomes a
          tracked ticket and a dispatched crew, live across the board.
        </p>
      </section>

      <StatCards />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <TicketQueue limit={4} viewAllHref="/tickets" />
        <ActivityFeed limit={8} viewAllHref="/activity" heightClass="max-h-[26rem]" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5" /> Start a live voice intake
            </CardTitle>
            <p className="mt-1 text-sm text-black/55">
              Talk to the ElevenLabs agent — it opens and dispatches a ticket while you speak.
            </p>
          </div>
          <Link
            href="/intake"
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black/85"
          >
            Voice intake
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-black/65 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f8f5ef] p-4">
            <p className="font-medium text-black">Phone &amp; SMS — Twilio</p>
            <p className="mt-1">Signature-verified webhooks triage and open tickets automatically.</p>
          </div>
          <div className="rounded-2xl bg-[#f8f5ef] p-4">
            <p className="font-medium text-black">Web voice — ElevenLabs</p>
            <p className="mt-1">Agent tool-calls drive the ticketing system in real time.</p>
          </div>
          <div className="rounded-2xl bg-[#f8f5ef] p-4">
            <p className="font-medium text-black">Cloudflare-native</p>
            <p className="mt-1">D1 stores every ticket and event; updates stream over SSE.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
