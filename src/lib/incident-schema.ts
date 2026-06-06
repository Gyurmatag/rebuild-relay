import { z } from "zod";

export const damageTypes = ["water", "fire", "storm", "mold", "biohazard", "unknown"] as const;
export const severities = ["low", "medium", "high", "critical"] as const;
export const incidentStatuses = ["new", "triage", "dispatched", "on_site", "resolved", "closed"] as const;
export const incidentSources = ["web", "phone", "sms", "voice_agent"] as const;
export const priorities = ["P1", "P2", "P3", "P4"] as const;

export type Priority = (typeof priorities)[number];

/** Map a severity onto a support-style priority. */
export function severityToPriority(severity: (typeof severities)[number]): Priority {
  switch (severity) {
    case "critical":
      return "P1";
    case "high":
      return "P2";
    case "medium":
      return "P3";
    default:
      return "P4";
  }
}

/** SLA response window per priority, in minutes. */
export const slaMinutes: Record<Priority, number> = {
  P1: 30,
  P2: 120,
  P3: 480,
  P4: 1440,
};

/**
 * Accept loosely-typed strings for enum-ish fields (an ElevenLabs agent or a
 * phone IVR rarely returns perfectly normalised values) and coerce them.
 */
const coercedEnum = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim().toLowerCase().replace(/\s+/g, "_"))
    .pipe(z.enum(values).catch(fallback));

const stringList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    if (!value) return [] as string[];
    const raw = Array.isArray(value) ? value : value.split(/[\n;]+/);
    return raw.map((item) => item.trim()).filter(Boolean);
  });

/** Input accepted when creating an incident (tool call, IVR, dashboard, SMS). */
export const incidentInputSchema = z.object({
  callerName: z.string().trim().min(1).catch("Unknown caller").default("Unknown caller"),
  phone: z.string().trim().optional(),
  address: z.string().trim().min(1).catch("Address pending").default("Address pending"),
  damageType: coercedEnum(damageTypes, "unknown"),
  severity: coercedEnum(severities, "high"),
  affectedAreas: stringList,
  safetyRisks: stringList,
  immediateActions: stringList,
  crewNeeds: stringList,
  summary: z.string().trim().min(1).catch("Incident intake in progress.").default("Incident intake in progress."),
  source: coercedEnum(incidentSources, "web"),
});

export type IncidentInput = z.infer<typeof incidentInputSchema>;

/** A persisted incident / ticket as returned to the UI. */
export type Incident = IncidentInput & {
  id: string;
  ticketNumber: string;
  status: (typeof incidentStatuses)[number];
  priority: Priority;
  assignee?: string | null;
  slaDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function severityRank(severity: Incident["severity"]): number {
  return severities.indexOf(severity);
}

/** A single entry in the ticket audit trail / activity feed. */
export type TicketEventType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "assigned"
  | "note"
  | "dispatch"
  | "inbound_sms"
  | "inbound_call"
  | "tool_invoked"
  | "recording"
  | "external_sync";

export type TicketEvent = {
  id: string;
  createdAt: string;
  ticketId: string | null;
  type: TicketEventType;
  actor: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};
