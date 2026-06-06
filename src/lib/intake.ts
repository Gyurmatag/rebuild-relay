import { syncIncidentToConnectors, type SyncOutcome } from "@/lib/connectors";
import type { Incident } from "@/lib/incident-schema";
import { dispatchIncident, type DispatchOutcome } from "@/lib/twilio";

export type FanOutResult = { dispatch: DispatchOutcome | null; sync: SyncOutcome };

/**
 * The single fan-out step for a freshly opened incident: alert the on-call crew
 * over Twilio and push the ticket to every connected external ticketing system.
 * Both are best-effort and never throw, so intake never fails on a side effect.
 */
export async function fanOutIncident(
  env: CloudflareEnv,
  incident: Incident,
  baseUrl: string,
): Promise<FanOutResult> {
  const dispatch = await dispatchIncident(env, incident, baseUrl).catch((error) => {
    console.error("dispatch failed", error);
    return null;
  });
  const sync = await syncIncidentToConnectors(env, incident).catch((error) => {
    console.error("external sync failed", error);
    return { synced: 0, failed: 0 } satisfies SyncOutcome;
  });
  return { dispatch, sync };
}
