"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import type { Incident, TicketEvent } from "@/lib/incident-schema";

export type Stats = { total: number; critical: number; active: number; resolved: number };

type RealtimeValue = {
  incidents: Incident[];
  stats: Stats | null;
  events: TicketEvent[];
  connected: boolean;
  now: number;
  phone: string;
  changeStatus: (id: string, status: Incident["status"]) => Promise<void>;
};

const RealtimeContext = createContext<RealtimeValue | null>(null);

export function useRealtime(): RealtimeValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within <RealtimeProvider>");
  return ctx;
}

/**
 * Holds the live operational state for the whole authenticated app. A single
 * EventSource is opened here (in the app layout) and kept alive across client
 * navigation between Overview / Tickets / Activity, so every page shares one
 * real-time stream rather than reconnecting per page.
 */
export function RealtimeProvider({
  phone,
  initialIncidents,
  initialStats,
  initialEvents,
  children,
}: {
  phone: string;
  initialIncidents: Incident[];
  initialStats: Stats | null;
  initialEvents: TicketEvent[];
  children: React.ReactNode;
}) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [stats, setStats] = useState<Stats | null>(initialStats);
  const [events, setEvents] = useState<TicketEvent[]>(initialEvents);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string>>(new Set(initialEvents.map((e) => e.id)));

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
      setConnected(true);
    });

    source.addEventListener("activity", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { events: TicketEvent[] };
      const fresh = (data.events ?? []).filter((e) => !seen.current.has(e.id));
      if (fresh.length === 0) return;
      fresh.forEach((e) => seen.current.add(e.id));
      setEvents((prev) => [...prev, ...fresh].slice(-200));
    });

    source.onerror = () => setConnected(false);

    return () => source.close();
  }, []);

  const changeStatus = useCallback(async (id: string, status: Incident["status"]) => {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }, []);

  return (
    <RealtimeContext.Provider value={{ incidents, stats, events, connected, now, phone, changeStatus }}>
      {children}
    </RealtimeContext.Provider>
  );
}
