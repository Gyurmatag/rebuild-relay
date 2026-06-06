import { resolveBaseUrl } from "@/lib/cf";
import {
  addNote,
  addTicketEvent,
  assignTicket,
  createIncident,
  findIncident,
  listIncidents,
  updateIncidentDetails,
  updateIncidentStatus,
} from "@/lib/db";
import { damageTypes, severities } from "@/lib/incident-schema";
import { dispatchIncident } from "@/lib/twilio";

/**
 * The agent tool catalog. These are the function-calling definitions an
 * ElevenLabs (or any LLM) agent invokes as server tools during a live call to
 * drive the ticketing system. The shape mirrors the OpenAI function-tool spec
 * so it can be dropped straight into an agent configuration.
 */
export const toolCatalog = [
  {
    type: "function",
    name: "create_incident",
    description:
      "Open a new restoration incident ticket from the caller's report and immediately dispatch the on-call crew. Use as soon as you understand the loss type and location.",
    parameters: {
      type: "object",
      properties: {
        callerName: { type: "string", description: "Caller's name if given." },
        phone: { type: "string", description: "Callback number in E.164 if known." },
        address: { type: "string", description: "Full property address of the loss." },
        damageType: { type: "string", enum: [...damageTypes] },
        severity: { type: "string", enum: [...severities] },
        affectedAreas: { type: "array", items: { type: "string" } },
        safetyRisks: { type: "array", items: { type: "string" } },
        immediateActions: { type: "array", items: { type: "string" } },
        crewNeeds: { type: "array", items: { type: "string" } },
        summary: { type: "string", description: "One or two sentence summary of the emergency." },
      },
      required: ["address", "damageType", "severity", "summary"],
    },
  },
  {
    type: "function",
    name: "update_incident",
    description:
      "Update an existing ticket as new facts emerge during the call — escalate severity, refine the summary, correct the address, or add a safety risk or crew need.",
    parameters: {
      type: "object",
      properties: {
        ticket: { type: "string", description: "Ticket number (RR-1042) or ticket id." },
        severity: { type: "string", enum: [...severities] },
        summary: { type: "string" },
        address: { type: "string" },
        damageType: { type: "string", enum: [...damageTypes] },
        addSafetyRisk: { type: "string" },
        addCrewNeed: { type: "string" },
      },
      required: ["ticket"],
    },
  },
  {
    type: "function",
    name: "dispatch_crew",
    description:
      "Dispatch (or re-dispatch) the on-call mitigation crew for a ticket and move it into the dispatched state. Sends the SMS crew brief.",
    parameters: {
      type: "object",
      properties: { ticket: { type: "string" } },
      required: ["ticket"],
    },
  },
  {
    type: "function",
    name: "assign_ticket",
    description: "Assign a ticket to a named responder or crew lead.",
    parameters: {
      type: "object",
      properties: { ticket: { type: "string" }, assignee: { type: "string" } },
      required: ["ticket", "assignee"],
    },
  },
  {
    type: "function",
    name: "add_note",
    description: "Append a free-text note to the ticket's audit trail.",
    parameters: {
      type: "object",
      properties: { ticket: { type: "string" }, note: { type: "string" } },
      required: ["ticket", "note"],
    },
  },
  {
    type: "function",
    name: "lookup_incident",
    description:
      "Look up a ticket by number/id, or list the most recent open tickets if no reference is given (useful for repeat callers).",
    parameters: {
      type: "object",
      properties: { ticket: { type: "string", description: "Optional ticket number or id." } },
      required: [],
    },
  },
] as const;

export type ToolName = (typeof toolCatalog)[number]["name"];

export type ToolResult = {
  ok: boolean;
  tool: string;
  result?: unknown;
  error?: string;
};

/**
 * Execute a tool call. Every invocation is first recorded in the audit trail as
 * a `tool_invoked` event so the live feed shows the agent acting in real time,
 * then the underlying ticket operation logs its own domain event.
 */
export async function runTool(
  env: CloudflareEnv,
  request: Request,
  name: string,
  args: Record<string, unknown>,
  actor = "voice_agent",
): Promise<ToolResult> {
  const ticketRef = typeof args.ticket === "string" ? args.ticket : null;

  await addTicketEvent(env, {
    ticketId: null,
    type: "tool_invoked",
    actor,
    message: `${actor} called ${name}(${ticketRef ? ticketRef : Object.keys(args).slice(0, 3).join(", ")})`,
    metadata: { tool: name, args },
  });

  switch (name) {
    case "create_incident": {
      const incident = await createIncident(env, { ...args, source: "voice_agent" });
      const dispatch = await dispatchIncident(env, incident, resolveBaseUrl(request, env)).catch(() => null);
      return { ok: true, tool: name, result: { ticket: incident.ticketNumber, id: incident.id, priority: incident.priority, dispatch } };
    }
    case "update_incident": {
      if (!ticketRef) return { ok: false, tool: name, error: "ticket is required" };
      const target = await findIncident(env, ticketRef);
      if (!target) return { ok: false, tool: name, error: `ticket ${ticketRef} not found` };
      const updated = await updateIncidentDetails(
        env,
        target.id,
        {
          severity: args.severity as never,
          summary: args.summary as string | undefined,
          address: args.address as string | undefined,
          damageType: args.damageType as never,
          addSafetyRisk: args.addSafetyRisk as string | undefined,
          addCrewNeed: args.addCrewNeed as string | undefined,
        },
        actor,
      );
      return { ok: true, tool: name, result: { ticket: updated?.ticketNumber, priority: updated?.priority, severity: updated?.severity } };
    }
    case "dispatch_crew": {
      if (!ticketRef) return { ok: false, tool: name, error: "ticket is required" };
      const target = await findIncident(env, ticketRef);
      if (!target) return { ok: false, tool: name, error: `ticket ${ticketRef} not found` };
      await updateIncidentStatus(env, target.id, "dispatched", actor);
      const dispatch = await dispatchIncident(env, target, resolveBaseUrl(request, env)).catch(() => null);
      return { ok: true, tool: name, result: { ticket: target.ticketNumber, status: "dispatched", dispatch } };
    }
    case "assign_ticket": {
      if (!ticketRef || typeof args.assignee !== "string") {
        return { ok: false, tool: name, error: "ticket and assignee are required" };
      }
      const target = await findIncident(env, ticketRef);
      if (!target) return { ok: false, tool: name, error: `ticket ${ticketRef} not found` };
      const updated = await assignTicket(env, target.id, args.assignee, actor);
      return { ok: true, tool: name, result: { ticket: updated?.ticketNumber, assignee: updated?.assignee } };
    }
    case "add_note": {
      if (!ticketRef || typeof args.note !== "string") {
        return { ok: false, tool: name, error: "ticket and note are required" };
      }
      const target = await findIncident(env, ticketRef);
      if (!target) return { ok: false, tool: name, error: `ticket ${ticketRef} not found` };
      await addNote(env, target.id, args.note, actor);
      return { ok: true, tool: name, result: { ticket: target.ticketNumber } };
    }
    case "lookup_incident": {
      if (ticketRef) {
        const target = await findIncident(env, ticketRef);
        return target
          ? { ok: true, tool: name, result: target }
          : { ok: false, tool: name, error: `ticket ${ticketRef} not found` };
      }
      const recent = await listIncidents(env, 5);
      return { ok: true, tool: name, result: recent };
    }
    default:
      return { ok: false, tool: name, error: `unknown tool: ${name}` };
  }
}
