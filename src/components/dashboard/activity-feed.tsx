"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  FileText,
  MessageSquare,
  PhoneIncoming,
  Plus,
  UserPlus,
  Wrench,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveBadge } from "@/components/dashboard/live-badge";
import { useRealtime } from "@/components/dashboard/realtime";
import { timeAgo } from "@/components/dashboard/format";
import type { TicketEvent } from "@/lib/incident-schema";

const eventIcon: Record<TicketEvent["type"], typeof Wrench> = {
  created: Plus,
  status_changed: ArrowUpRight,
  priority_changed: AlertTriangle,
  assigned: UserPlus,
  note: FileText,
  dispatch: Bell,
  inbound_sms: MessageSquare,
  inbound_call: PhoneIncoming,
  tool_invoked: Wrench,
  recording: FileText,
};

export function ActivityFeed({
  limit,
  viewAllHref,
  heightClass = "max-h-[34rem]",
}: {
  limit?: number;
  viewAllHref?: string;
  heightClass?: string;
}) {
  const { events, connected, now } = useRealtime();
  const ordered = useMemo(() => {
    const reversed = [...events].reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }, [events, limit]);

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Live activity</CardTitle>
        <LiveBadge connected={connected} />
      </CardHeader>
      <CardContent className="flex-1">
        {ordered.length === 0 ? (
          <p className="py-8 text-center text-sm text-black/45">
            Waiting for activity — agent tool calls, dispatches, and status changes stream here in real time.
          </p>
        ) : (
          <ol className={`relative space-y-3 overflow-y-auto pr-1 ${heightClass}`}>
            {ordered.map((event) => {
              const Icon = eventIcon[event.type] ?? FileText;
              const isTool = event.type === "tool_invoked";
              return (
                <li key={event.id} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isTool ? "bg-black text-white" : "bg-[#f0eee9] text-black/70"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{event.message}</p>
                    <p className="mt-0.5 text-xs text-black/40">
                      {event.actor} · {timeAgo(event.createdAt, now)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {viewAllHref && events.length > (limit ?? 0) ? (
          <Link
            href={viewAllHref}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-black hover:underline"
          >
            View full activity log
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
