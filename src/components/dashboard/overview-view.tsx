"use client";

import Link from "next/link";
import { ArrowUpRight, ListChecks, Plug, Radio } from "lucide-react";

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
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/tickets"
            className="group rounded-2xl border border-black/10 bg-[#f8f5ef] p-4 transition hover:border-black/25"
          >
            <ListChecks className="h-5 w-5" />
            <p className="mt-3 flex items-center gap-1 font-medium text-black">
              Work the queue
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </p>
            <p className="mt-1 text-sm text-black/55">Triage, assign, and resolve open tickets.</p>
          </Link>
          <Link
            href="/activity"
            className="group rounded-2xl border border-black/10 bg-[#f8f5ef] p-4 transition hover:border-black/25"
          >
            <Radio className="h-5 w-5" />
            <p className="mt-3 flex items-center gap-1 font-medium text-black">
              Live activity
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </p>
            <p className="mt-1 text-sm text-black/55">Follow every dispatch and update as it happens.</p>
          </Link>
          <Link
            href="/integrations"
            className="group rounded-2xl border border-black/10 bg-[#f8f5ef] p-4 transition hover:border-black/25"
          >
            <Plug className="h-5 w-5" />
            <p className="mt-3 flex items-center gap-1 font-medium text-black">
              Integrations
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </p>
            <p className="mt-1 text-sm text-black/55">Sync tickets to your existing ticketing system.</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
