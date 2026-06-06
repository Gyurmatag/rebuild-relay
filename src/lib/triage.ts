import type { Incident } from "@/lib/incident-schema";

/**
 * Lightweight keyword triage for unstructured intake (phone speech / SMS body).
 * The ElevenLabs agent returns structured fields; these heuristics give the
 * phone and SMS channels a sensible starting classification that operators can
 * refine from the dashboard.
 */

const DAMAGE_KEYWORDS: Record<Exclude<Incident["damageType"], "unknown">, string[]> = {
  fire: ["fire", "smoke", "burn", "flame", "soot"],
  water: ["water", "flood", "pipe", "burst", "leak", "sewage", "overflow", "ceiling"],
  storm: ["storm", "wind", "hurricane", "tornado", "hail", "tree", "roof"],
  mold: ["mold", "mould", "mildew", "fungus"],
  biohazard: ["biohazard", "sewage backup", "trauma", "asbestos", "chemical"],
};

const CRITICAL_KEYWORDS = [
  "gas",
  "electrical",
  "outlet",
  "shock",
  "danger",
  "trapped",
  "collapse",
  "elderly",
  "child",
  "injured",
  "fire",
  "smoke",
  "evacuat",
];

export function classifyDamage(text: string): Incident["damageType"] {
  const lower = text.toLowerCase();
  let best: Incident["damageType"] = "unknown";
  let bestScore = 0;
  for (const [type, keywords] of Object.entries(DAMAGE_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = type as Incident["damageType"];
    }
  }
  return best;
}

export function classifySeverity(text: string): Incident["severity"] {
  const lower = text.toLowerCase();
  const hits = CRITICAL_KEYWORDS.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);
  if (hits >= 2) return "critical";
  if (hits === 1) return "high";
  return "medium";
}
