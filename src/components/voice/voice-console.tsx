"use client";

import { useMemo, useState } from "react";
import { Mic, PhoneCall, PhoneOff, Sparkles } from "lucide-react";
import { Conversation } from "@elevenlabs/client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Status = "idle" | "connecting" | "live" | "error";

export function VoiceConsole() {
  const [status, setStatus] = useState<Status>("idle");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState("Ready for emergency intake");

  const statusLabel = useMemo(() => {
    if (status === "live") return "Live with ElevenLabs";
    if (status === "connecting") return "Connecting voice agent";
    if (status === "error") return "Demo fallback active";
    return "Voice agent standing by";
  }, [status]);

  async function startCall() {
    try {
      setStatus("connecting");
      setMessage("Requesting secure session URL...");

      const response = await fetch("/api/elevenlabs/signed-url", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const { signedUrl } = (await response.json()) as { signedUrl: string };
      setMessage("Microphone permission may be requested.");

      const session = await Conversation.startSession({
        signedUrl,
        onConnect: () => {
          setStatus("live");
          setMessage("Ask: 'A pipe burst in apartment 4B and water is near outlets.'");
        },
        onDisconnect: () => {
          setStatus("idle");
          setMessage("Call ended. Review the dispatch packet.");
        },
        onError: () => {
          setStatus("error");
          setMessage("Unable to reach the voice agent. Use the seeded demo packet.");
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
    setMessage("Call ended. Review the dispatch packet.");
  }

  return (
    <div className="rounded-[1.75rem] border border-black/10 bg-[#f8f5ef] p-4">
      <div className="flex items-center justify-between gap-4">
        <Badge className="gap-2 bg-white">
          <span className="h-2 w-2 rounded-full bg-[#58a06d]" />
          {statusLabel}
        </Badge>
        <Sparkles className="h-4 w-4 text-black/50" />
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div className="orb grid h-28 w-28 place-items-center bg-[radial-gradient(circle_at_30%_20%,#fff_0,#ff7a88_24%,#7f73ff_54%,#a2b978_100%)]">
          <Mic className="relative z-10 h-8 w-8 text-white drop-shadow" />
        </div>
        <div>
          <p className="text-sm text-black/55">Live triage prompt</p>
          <p className="mt-2 max-w-sm text-xl font-medium leading-tight">{message}</p>
        </div>
      </div>

      <div className="mt-6 h-12 rounded-full bg-white p-3">
        <div className="voice-wave h-full rounded-full opacity-20" />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={startCall} disabled={status === "connecting" || status === "live"} className="gap-2">
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
