"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Incident } from "@/lib/incident-schema";
import { incidentStatuses } from "@/lib/incident-schema";

type Stats = { total: number; critical: number; active: number; resolved: number };

const severityStyles: Record<Incident["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const sourceLabels: Record<Incident["source"], string> = {
  web: "Web",
  phone: "Phone",
  sms: "SMS",
  voice_agent: "Voice agent",
};

const statusLabels: Record<Incident["status"], string> = {
  new: "New",
  dispatched: "Dispatched",
  on_site: "On site",
  resolved: "Resolved",
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function OperationsDashboard({
  initialIncidents,
  initialStats,
  phoneNumber,
}: {
  initialIncidents: Incident[];
  initialStats: Stats | null;
  phoneNumber: string;
}) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [stats, setStats] = useState<Stats | null>(initialStats);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const liveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/incidents", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { incidents: Incident[]; stats: Stats | null };
      if (liveRef.current) {
        setIncidents(data.incidents ?? []);
        setStats(data.stats ?? null);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    liveRef.current = true;
    const interval = setInterval(refresh, 7000);
    return () => {
      liveRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  async function changeStatus(id: string, status: Incident["status"]) {
    setUpdatingId(id);
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      await fetch(`/api/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  const statCards: { label: string; value: number; accent: string }[] = [
    { label: "Total incidents", value: stats?.total ?? incidents.length, accent: "text-black" },
    { label: "Critical", value: stats?.critical ?? 0, accent: "text-red-600" },
    { label: "Active", value: stats?.active ?? 0, accent: "text-orange-600" },
    { label: "Resolved", value: stats?.resolved ?? 0, accent: "text-emerald-600" },
  ];

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

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Live incident board</CardTitle>
            <p className="mt-1 text-sm text-black/55">
              Calls and texts to{" "}
              <span className="font-medium text-black">{phoneNumber || "the emergency line"}</span> land here
              automatically.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 bg-[#f8f5ef] px-6 py-12 text-center text-sm text-black/55">
              No incidents yet. Start a voice intake below, or call / text the emergency line to create the first
              tracked incident.
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-2xl border border-black/10 bg-white p-4 transition hover:border-black/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={severityStyles[incident.severity]}>
                          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                          {incident.severity}
                        </Badge>
                        <span className="text-sm font-medium capitalize">{incident.damageType} loss</span>
                        <Badge className="bg-[#f0eee9] text-black/60">{sourceLabels[incident.source]}</Badge>
                        <span className="text-xs text-black/45">{timeAgo(incident.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{incident.address}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-black/60">{incident.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/50">
                        <span>{incident.callerName}</span>
                        {incident.phone ? <span>{incident.phone}</span> : null}
                        {incident.safetyRisks.length ? (
                          <span className="text-red-600">
                            {incident.safetyRisks.length} safety risk{incident.safetyRisks.length > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <PhoneCall className="h-5 w-5" />
            <CardTitle>Phone intake</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-black/60">
            Callers dial the Twilio line; speech is transcribed, triaged, and turned into a tracked incident with an
            automatic crew dispatch.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <MessageSquare className="h-5 w-5" />
            <CardTitle>SMS intake</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-black/60">
            Texts to the same number open an incident and trigger an SMS dispatch to the on-call crew, with delivery
            tracked end to end.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Truck className="h-5 w-5" />
            <CardTitle>Crew dispatch</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-black/60">
            Every critical incident fans out a Twilio SMS brief to on-call responders and a confirmation back to the
            caller.
          </CardContent>
        </Card>
      </section>

      <p className="flex items-center gap-2 px-1 text-xs text-black/45">
        <ShieldCheck className="h-3.5 w-3.5" />
        Webhooks are signature-verified, credentials live in Wrangler secrets, and every incident, message, and call
        is persisted in D1.
      </p>
    </div>
  );
}
