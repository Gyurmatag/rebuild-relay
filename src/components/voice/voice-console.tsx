"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, PhoneCall, PhoneOff, Sparkles, Wrench } from "lucide-react";
import { Conversation } from "@elevenlabs/client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Status = "idle" | "connecting" | "live" | "error";
type Mode = "speaking" | "listening";
type Turn = { id: string; kind: "user" | "agent" | "tool"; text: string };

const TOOL_NAMES = [
  "create_incident",
  "update_incident",
  "dispatch_crew",
  "assign_ticket",
  "add_note",
  "lookup_incident",
] as const;

export function VoiceConsole() {
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<Mode>("listening");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState("Ready for emergency intake");
  const [turns, setTurns] = useState<Turn[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  const statusLabel = useMemo(() => {
    if (status === "live") return mode === "speaking" ? "Agent speaking" : "Listening";
    if (status === "connecting") return "Connecting voice agent";
    if (status === "error") return "Voice agent unavailable";
    return "Voice agent standing by";
  }, [status, mode]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function pushTurn(kind: Turn["kind"], text: string) {
    setTurns((prev) => [...prev, { id: crypto.randomUUID(), kind, text }].slice(-40));
  }

  /** Execute a ticketing tool the agent invoked, and speak back a short result. */
  async function invokeTool(tool: string, params: Record<string, unknown>): Promise<string> {
    try {
      const res = await fetch("/api/tools/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, arguments: params }),
      });
      const data = (await res.json()) as { ok: boolean; result?: Record<string, unknown> | unknown[]; error?: string };
      if (!data.ok) {
        pushTurn("tool", `${tool} failed: ${data.error ?? "error"}`);
        return `That didn't work: ${data.error ?? "unknown error"}`;
      }
      const r = (data.result ?? {}) as Record<string, unknown>;
      const ticket = (r.ticket as string) ?? (r.ticketNumber as string) ?? "";
      pushTurn("tool", `${tool}${ticket ? ` → ${ticket}` : ""}`);
      switch (tool) {
        case "create_incident":
          return `Opened ticket ${ticket} as ${r.priority ?? "a"} priority. I'm dispatching the crew now.`;
        case "dispatch_crew":
          return `Crew dispatched for ${ticket}.`;
        case "update_incident":
          return `Updated ${ticket}${r.priority ? `, now ${r.priority}` : ""}.`;
        case "assign_ticket":
          return `Assigned ${ticket} to ${r.assignee ?? "the crew lead"}.`;
        case "add_note":
          return `Note added to ${ticket}.`;
        case "lookup_incident":
          return Array.isArray(data.result)
            ? `I found ${data.result.length} recent tickets.`
            : `Ticket ${ticket}.`;
        default:
          return "Done.";
      }
    } catch (error) {
      const m = error instanceof Error ? error.message : "request failed";
      pushTurn("tool", `${tool} error: ${m}`);
      return `Sorry, that failed: ${m}`;
    }
  }

  async function startCall() {
    try {
      setStatus("connecting");
      setTurns([]);
      setMessage("Requesting secure session URL…");

      const response = await fetch("/api/elevenlabs/signed-url", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const { signedUrl } = (await response.json()) as { signedUrl: string };

      setMessage("Microphone permission may be requested.");

      const clientTools = Object.fromEntries(
        TOOL_NAMES.map((name) => [name, (params: Record<string, unknown>) => invokeTool(name, params)]),
      );

      const session = await Conversation.startSession({
        signedUrl,
        clientTools,
        onConnect: () => {
          setStatus("live");
          setMessage("Try: \u201cA pipe burst in apartment 4B and water is near the outlets.\u201d");
        },
        onDisconnect: () => {
          setStatus("idle");
          setMessage("Call ended. The ticket is on the board above.");
        },
        onError: (m) => {
          setStatus("error");
          setMessage(m || "Unable to reach the voice agent. Configure ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID.");
        },
        onModeChange: ({ mode: m }) => setMode(m),
        onMessage: ({ message: text, role }) => {
          if (text?.trim()) pushTurn(role === "user" ? "user" : "agent", text);
        },
        onUnhandledClientToolCall: (call) => {
          // Server-side tools are handled by the API; surface them too.
          pushTurn("tool", `${call?.tool_name ?? "tool"} (server)`);
        },
      });

      setConversation(session);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to start voice session.");
    }
  }

  async function endCall() {
    await conversation?.endSession();
    setConversation(null);
    setStatus("idle");
    setMessage("Call ended. The ticket is on the board above.");
  }

  const live = status === "live";

  return (
    <div className="rounded-[1.75rem] border border-black/10 bg-[#f8f5ef] p-4">
      <div className="flex items-center justify-between gap-4">
        <Badge className="gap-2 bg-white">
          <span className={`h-2 w-2 rounded-full ${live ? "bg-[#58a06d]" : "bg-black/30"}`} />
          {statusLabel}
        </Badge>
        <Sparkles className="h-4 w-4 text-black/50" />
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div
          className={`orb grid h-24 w-24 shrink-0 place-items-center bg-[radial-gradient(circle_at_30%_20%,#fff_0,#ff7a88_24%,#7f73ff_54%,#a2b978_100%)] ${
            live && mode === "speaking" ? "animate-pulse" : ""
          }`}
        >
          <Mic className="relative z-10 h-7 w-7 text-white drop-shadow" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-black/55">Live triage</p>
          <p className="mt-1 text-lg font-medium leading-tight">{message}</p>
        </div>
      </div>

      {turns.length > 0 ? (
        <div
          ref={feedRef}
          className="mt-5 max-h-52 space-y-2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-3"
        >
          {turns.map((t) => {
            if (t.kind === "tool") {
              return (
                <div key={t.id} className="flex items-center gap-2 text-xs font-medium text-[#7f73ff]">
                  <Wrench className="h-3.5 w-3.5" />
                  <span className="font-mono">{t.text}</span>
                </div>
              );
            }
            return (
              <div key={t.id} className={t.kind === "user" ? "text-right" : "text-left"}>
                <span
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                    t.kind === "user" ? "bg-black text-white" : "bg-[#f0eee9] text-black"
                  }`}
                >
                  {t.text}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 h-12 rounded-full bg-white p-3">
          <div className="voice-wave h-full rounded-full opacity-20" />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={startCall} disabled={status === "connecting" || live} className="gap-2">
          <PhoneCall className="h-4 w-4" />
          Start ElevenLabs call
        </Button>
        <Button onClick={endCall} disabled={!conversation} variant="outline" className="gap-2">
          <PhoneOff className="h-4 w-4" />
          End call
        </Button>
      </div>
    </div>
  );
}
