import { z } from "zod";

export const damageTypes = ["water", "fire", "storm", "mold", "biohazard", "unknown"] as const;
export const severities = ["low", "medium", "high", "critical"] as const;
export const incidentStatuses = ["new", "dispatched", "on_site", "resolved"] as const;
export const incidentSources = ["web", "phone", "sms", "voice_agent"] as const;

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

/** A persisted incident as returned to the UI. */
export type Incident = IncidentInput & {
  id: string;
  status: (typeof incidentStatuses)[number];
  createdAt: string;
  updatedAt: string;
};

export function severityRank(severity: Incident["severity"]): number {
  return severities.indexOf(severity);
}
