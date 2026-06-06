import type { Metadata } from "next";

import { ActivityFeed } from "@/components/dashboard/activity-feed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity — Rebuild Relay" };

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">Live activity</h1>
        <p className="mt-1 text-sm text-black/55">
          Every ticket event, dispatch, and agent tool call — streamed in real time over SSE.
        </p>
      </div>
      <ActivityFeed heightClass="max-h-[70vh]" />
    </div>
  );
}
