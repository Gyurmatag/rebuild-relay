import type { Metadata } from "next";

import { StatCards } from "@/components/dashboard/stat-cards";
import { TicketQueue } from "@/components/dashboard/ticket-queue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tickets — Rebuild Relay" };

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">Tickets</h1>
        <p className="mt-1 text-sm text-black/55">The full live queue across phone, SMS, and the web voice agent.</p>
      </div>
      <StatCards />
      <TicketQueue />
    </div>
  );
}
