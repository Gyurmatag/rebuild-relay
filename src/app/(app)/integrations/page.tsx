import type { Metadata } from "next";

import { IntegrationsView } from "@/components/integrations/integrations-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integrations — Rebuild Relay" };

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-black/55">
          Connect your existing ticketing system. Every incident Rebuild Relay opens is pushed out automatically — via
          a remote <span className="font-medium text-black">MCP server</span>, a generic{" "}
          <span className="font-medium text-black">API / webhook</span>, or{" "}
          <span className="font-medium text-black">Linear</span>.
        </p>
      </div>
      <IntegrationsView />
    </div>
  );
}
