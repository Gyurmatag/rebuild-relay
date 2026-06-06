import { z } from "zod";

export const incidentSchema = z.object({
  callerName: z.string().default("Unknown caller"),
  phone: z.string().optional(),
  address: z.string().default("Address pending"),
  damageType: z.enum(["water", "fire", "storm", "mold", "biohazard", "unknown"]).default("unknown"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("high"),
  affectedAreas: z.array(z.string()).default([]),
  safetyRisks: z.array(z.string()).default([]),
  immediateActions: z.array(z.string()).default([]),
  crewNeeds: z.array(z.string()).default([]),
  summary: z.string().default("Incident intake in progress."),
});

export type Incident = z.infer<typeof incidentSchema>;

export const demoIncident: Incident = {
  callerName: "Maya Chen",
  phone: "(212) 555-0134",
  address: "221 Canal St, Apt 4B, New York, NY",
  damageType: "water",
  severity: "critical",
  affectedAreas: ["Kitchen ceiling", "Hallway", "Electrical outlet wall"],
  safetyRisks: ["Standing water near outlets", "Sagging ceiling", "Elderly tenant on site"],
  immediateActions: ["Shut off water main", "Avoid electrical switches", "Dispatch mitigation crew within 30 minutes"],
  crewNeeds: ["Water extraction", "Moisture mapping", "Temporary containment", "Photo documentation"],
  summary:
    "Burst pipe above apartment 4B with active water intrusion, electrical risk, and vulnerable occupant. Treat as emergency mitigation.",
};
