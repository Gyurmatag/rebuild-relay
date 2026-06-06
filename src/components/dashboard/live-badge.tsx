"use client";

export function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium shadow-sm">
      <span className="relative flex h-2 w-2">
        {connected ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-black/30"}`} />
      </span>
      {connected ? "Live" : "Reconnecting"}
    </span>
  );
}
