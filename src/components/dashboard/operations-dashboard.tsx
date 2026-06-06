"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  FileText,
  MessageSquare,
  PhoneIncoming,
  Plus,
  UserPlus,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Incident, Priority, TicketEvent } from "@/lib/incident-schema";
import { incidentStatuses } from "@/lib/incident-schema";

type Stats = { total: number; critical: number; active: number; resolved: number };

const severityStyles: Record<Incident["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const priorityStyles: Record<Priority, string> = {
  P1: "bg-red-600 text-white",
  P2: "bg-orange-500 text-white",
  P3: "bg-amber-400 text-black",
  P4: "bg-slate-300 text-black",
};

const sourceLabels: Record<Incident["source"], string> = {
  web: "Web",
  phone: "Phone",
  sms: "SMS",
  voice_agent: "Voice agent",
};

const statusLabels: Record<Incident["status"], string> = {
  new: "New",
  triage: "Triage",
  dispatched: "Dispatched",
  on_site: "On site",
  resolved: "Resolved",
  closed: "Closed",
};

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

function timeAgo(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function slaLabel(incident: Incident, now: number): { text: string; overdue: boolean } | null {
  if (!incident.slaDueAt || incident.status === "resolved" || incident.status === "closed") return null;
  const due = new Date(incident.slaDueAt).getTime();
  if (Number.isNaN(due)) return null;
  const diffMin = Math.round((due - now) / 60000);
  if (diffMin < 0) return { text: `SLA ${Math.abs(diffMin)}m over`, overdue: true };
  if (diffMin < 60) return { text: `SLA ${diffMin}m`, overdue: false };
  return { text: `SLA ${Math.floor(diffMin / 60)}h`, overdue: false };
}

export function OperationsDashboard({
  initialIncidents,
  initialStats,
  initialEvents,
  phoneNumber,
}: {
  initialIncidents: Incident[];
  initialStats: Stats | null;
  initialEvents: TicketEvent[];
  phoneNumber: string;
}) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [stats, setStats] = useState<Stats | null>(initialStats);
  const [events, setEvents] = useState<TicketEvent[]>(initialEvents);
  const [connected, setConnected] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seenEventIds = useRef<Set<string>>(new Set(initialEvents.map((e) => e.id)));

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.addEventListener("open", () => setConnected(true));

    source.addEventListener("snapshot", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { incidents: Incident[]; stats: Stats };
      setIncidents(data.incidents ?? []);
      setStats(data.stats ?? null);
      setNow(Date.now());
    });

    source.addEventListener("activity", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { events: TicketEvent[] };
      const fresh = (data.events ?? []).filter((e) => !seenEventIds.current.has(e.id));
      if (fresh.length === 0) return;
      fresh.forEach((e) => seenEventIds.current.add(e.id));
      setEvents((prev) => [...prev, ...fresh].slice(-80));
    });

    source.onerror = () => setConnected(false);

    return () => source.close();
  }, []);

  async function changeStatus(id: string, status: Incident["status"]) {
    setUpdatingId(id);
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      await fetch(`/api/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } finally {
      setUpdatingId(null);
    }
  }

  const statCards: { label: string; value: number; accent: string }[] = [
    { label: "Total tickets", value: stats?.total ?? incidents.length, accent: "text-black" },
    { label: "Critical", value: stats?.critical ?? 0, accent: "text-red-600" },
    { label: "Active", value: stats?.active ?? 0, accent: "text-orange-600" },
    { label: "Resolved", value: stats?.resolved ?? 0, accent: "text-emerald-600" },
  ];

  const orderedEvents = useMemo(() => [...events].reverse(), [events]);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-black/55">{card.label}</p>
              <p className={`mt-2 text-4xl font-semibold tracking-tight ${card.accent}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Ticket queue</CardTitle>
              <p className="mt-1 text-sm text-black/55">
                Calls and texts to{" "}
                <span className="font-medium text-black">{phoneNumber || "the emergency line"}</span> open tickets
                automatically.
              </p>
            </div>
            <LiveBadge connected={connected} />
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/15 bg-[#f8f5ef] px-6 py-12 text-center text-sm text-black/55">
                No tickets yet. Start a voice intake below, or call / text the emergency line to open the first
                ticket.
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((incident) => {
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
                          onChange={(event) => changeStatus(incident.id, event.target.value as Incident["status"])}
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
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Live activity</CardTitle>
            <LiveBadge connected={connected} />
          </CardHeader>
          <CardContent className="flex-1">
            {orderedEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-black/45">
                Waiting for activity — agent tool calls, dispatches, and status changes stream here in real time.
              </p>
            ) : (
              <ol className="relative max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                {orderedEvents.map((event) => {
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
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 px-1 text-xs text-black/45">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Agent tool calls drive the ticketing system; every action is signature-verified, persisted in D1, and streamed
        live over SSE.
      </p>
    </div>
  );
}

function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium shadow-sm">
      <span className="relative flex h-2 w-2">
        {connected ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-black/30"}`} />
      </span>
      {connected ? "Live" : "Reconnecting"}
    </span>
  );
}
