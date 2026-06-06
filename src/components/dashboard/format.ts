import type { Incident, Priority } from "@/lib/incident-schema";

export const severityStyles: Record<Incident["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export const priorityStyles: Record<Priority, string> = {
  P1: "bg-red-600 text-white",
  P2: "bg-orange-500 text-white",
  P3: "bg-amber-400 text-black",
  P4: "bg-slate-300 text-black",
};

export const sourceLabels: Record<Incident["source"], string> = {
  web: "Web",
  phone: "Phone",
  sms: "SMS",
  voice_agent: "Voice agent",
};

export const statusLabels: Record<Incident["status"], string> = {
  new: "New",
  triage: "Triage",
  dispatched: "Dispatched",
  on_site: "On site",
  resolved: "Resolved",
  closed: "Closed",
};

export function timeAgo(iso: string, now: number): string {
  // now === 0 means "not yet mounted" — render nothing to keep SSR/client in sync.
  if (!now) return "";
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

export function slaLabel(incident: Incident, now: number): { text: string; overdue: boolean } | null {
  if (!now) return null;
  if (!incident.slaDueAt || incident.status === "resolved" || incident.status === "closed") return null;
  const due = new Date(incident.slaDueAt).getTime();
  if (Number.isNaN(due)) return null;
  const diffMin = Math.round((due - now) / 60000);
  if (diffMin < 0) return { text: `SLA ${Math.abs(diffMin)}m over`, overdue: true };
  if (diffMin < 60) return { text: `SLA ${diffMin}m`, overdue: false };
  return { text: `SLA ${Math.floor(diffMin / 60)}h`, overdue: false };
}
