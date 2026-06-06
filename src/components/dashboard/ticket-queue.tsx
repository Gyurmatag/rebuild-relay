"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveBadge } from "@/components/dashboard/live-badge";
import { useRealtime } from "@/components/dashboard/realtime";
import {
  priorityStyles,
  severityStyles,
  slaLabel,
  sourceLabels,
  statusLabels,
  timeAgo,
} from "@/components/dashboard/format";
import type { Incident } from "@/lib/incident-schema";
import { incidentStatuses } from "@/lib/incident-schema";

export function TicketQueue({ limit, viewAllHref }: { limit?: number; viewAllHref?: string }) {
  const { incidents, changeStatus, connected, now, phone } = useRealtime();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const rows = limit ? incidents.slice(0, limit) : incidents;

  async function onChange(id: string, status: Incident["status"]) {
    setUpdatingId(id);
    try {
      await changeStatus(id, status);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Ticket queue</CardTitle>
          <p className="mt-1 text-sm text-black/55">
            Calls and texts to{" "}
            <span className="font-medium text-black">{phone || "the emergency line"}</span> open tickets
            automatically.
          </p>
        </div>
        <LiveBadge connected={connected} />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-[#f8f5ef] px-6 py-12 text-center text-sm text-black/55">
            No tickets yet. Start a voice intake, or call / text the emergency line — new tickets appear here in real
            time.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((incident) => {
              const sla = slaLabel(incident, now);
              return (
                <div
                  key={incident.id}
                  className="rounded-2xl border border-black/10 bg-white p-4 transition hover:border-black/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${priorityStyles[incident.priority]}`}>
                          {incident.priority}
                        </span>
                        <span className="font-mono text-xs font-medium text-black/60">{incident.ticketNumber}</span>
                        <Badge className={severityStyles[incident.severity]}>
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {incident.severity}
                        </Badge>
                        <span className="text-sm font-medium capitalize">{incident.damageType}</span>
                        <Badge className="bg-[#f0eee9] text-black/60">{sourceLabels[incident.source]}</Badge>
                        {sla ? (
                          <span className={`text-xs font-medium ${sla.overdue ? "text-red-600" : "text-emerald-600"}`}>
                            {sla.text}
                          </span>
                        ) : null}
                        <span className="text-xs text-black/40">{timeAgo(incident.createdAt, now)}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{incident.address}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-black/60">{incident.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/50">
                        <span>{incident.callerName}</span>
                        {incident.phone ? <span>{incident.phone}</span> : null}
                        {incident.assignee ? <span className="text-black/70">→ {incident.assignee}</span> : null}
                        {incident.safetyRisks.length ? (
                          <span className="text-red-600">
                            {incident.safetyRisks.length} safety risk{incident.safetyRisks.length > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <select
                      value={incident.status}
                      onChange={(event) => onChange(incident.id, event.target.value as Incident["status"])}
                      disabled={updatingId === incident.id}
                      className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium shadow-sm outline-none focus:border-black/40"
                    >
                      {incidentStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewAllHref && incidents.length > (limit ?? 0) ? (
          <Link
            href={viewAllHref}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-black hover:underline"
          >
            View all {incidents.length} tickets
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
