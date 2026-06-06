"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, Plus, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConnectorType = "webhook" | "mcp" | "linear";

type Connector = {
  id: string;
  name: string;
  type: ConnectorType;
  enabled: boolean;
  config: Record<string, string>;
  lastStatus: "ok" | "error" | "untested" | null;
  lastDetail: string | null;
};

const typeLabels: Record<ConnectorType, string> = {
  webhook: "API / Webhook",
  mcp: "MCP server",
  linear: "Linear",
};

const typeBlurb: Record<ConnectorType, string> = {
  webhook: "POST each incident as JSON to any HTTP endpoint (your API, Zapier, Make, etc.).",
  mcp: "Call a tool on a remote Model Context Protocol server over Streamable HTTP.",
  linear: "Create a Linear issue for every incident in the team you choose.",
};

export function IntegrationsView() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/connectors", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { connectors: Connector[] };
      setConnectors(data.connectors ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(c: Connector) {
    setBusyId(c.id);
    setConnectors((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await fetch(`/api/connectors/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !c.enabled }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Connector) {
    setBusyId(c.id);
    try {
      await fetch(`/api/connectors/${c.id}`, { method: "DELETE" });
      setConnectors((prev) => prev.filter((x) => x.id !== c.id));
    } finally {
      setBusyId(null);
    }
  }

  async function test(c: Connector) {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/connectors/${c.id}/test`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; detail: string };
      setTestResult((prev) => ({ ...prev, [c.id]: data }));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const [addingDemo, setAddingDemo] = useState(false);
  async function addLinearDemo() {
    setAddingDemo(true);
    try {
      await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Linear (MCP demo)",
          type: "mcp",
          config: { url: `${window.location.origin}/api/mcp/linear-demo`, toolName: "create_issue" },
        }),
      });
      await load();
    } finally {
      setAddingDemo(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black/55">
          {connectors.length} connector{connectors.length === 1 ? "" : "s"} configured
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addLinearDemo} disabled={addingDemo} className="gap-2">
            {addingDemo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Add Linear (MCP demo)
          </Button>
          <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add connector
          </Button>
        </div>
      </div>

      {showForm ? (
        <AddConnectorForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-black/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connectors…
        </div>
      ) : connectors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f0eee9]">
              <Plug className="h-5 w-5 text-black/60" />
            </span>
            <p className="text-sm text-black/60">
              No external ticketing systems connected yet. Add an MCP server, an API/webhook, or Linear — every new
              incident will sync there automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {connectors.map((c) => {
            const result = testResult[c.id];
            const status = result ?? (c.lastStatus && c.lastStatus !== "untested"
              ? { ok: c.lastStatus === "ok", detail: c.lastDetail ?? "" }
              : null);
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <span className="rounded-full bg-[#f0eee9] px-2.5 py-0.5 text-xs font-medium text-black/60">
                        {typeLabels[c.type]}
                      </span>
                      {c.enabled ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Enabled
                        </span>
                      ) : (
                        <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs font-medium text-black/50">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-black/45">
                      {c.config.url || (c.type === "linear" ? `Team ${c.config.teamId ?? ""}` : "")}
                      {c.config.toolName ? ` · ${c.config.toolName}` : ""}
                    </p>
                    {status ? (
                      <p
                        className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${
                          status.ok ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {status.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {status.detail}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => test(c)} disabled={busyId === c.id}>
                      {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Test"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggle(c)} disabled={busyId === c.id}>
                      {c.enabled ? "Disable" : "Enable"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      disabled={busyId === c.id}
                      aria-label="Delete connector"
                      className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-black/50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddConnectorForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [type, setType] = useState<ConnectorType>("mcp");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, config }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not create connector");
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add a connector</CardTitle>
        <p className="text-sm text-black/55">{typeBlurb[type]}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ops Linear, Internal API"
                required
              />
            </Field>
            <Field label="Type">
              <select
                className="auth-input"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ConnectorType);
                  setConfig({});
                }}
              >
                <option value="mcp">MCP server</option>
                <option value="webhook">API / Webhook</option>
                <option value="linear">Linear</option>
              </select>
            </Field>
          </div>

          {type === "mcp" ? (
            <>
              <Field label="MCP server URL (Streamable HTTP)">
                <input
                  className="auth-input"
                  value={config.url ?? ""}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://your-mcp-server.com/mcp"
                  required
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tool name">
                  <input
                    className="auth-input"
                    value={config.toolName ?? ""}
                    onChange={(e) => set("toolName", e.target.value)}
                    placeholder="create_issue"
                    required
                  />
                </Field>
                <Field label="Bearer token (optional)">
                  <input
                    className="auth-input"
                    type="password"
                    value={config.token ?? ""}
                    onChange={(e) => set("token", e.target.value)}
                    placeholder="••••••"
                  />
                </Field>
              </div>
              <p className="text-xs text-black/45">
                Real Linear MCP: use <span className="font-mono">https://mcp.linear.app/mcp</span>, tool{" "}
                <span className="font-mono">create_issue</span>, and your Linear API key as the bearer token.
              </p>
            </>
          ) : null}

          {type === "webhook" ? (
            <>
              <Field label="Endpoint URL">
                <input
                  className="auth-input"
                  value={config.url ?? ""}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://api.yoursystem.com/tickets"
                  required
                />
              </Field>
              <Field label="Bearer token (optional)">
                <input
                  className="auth-input"
                  type="password"
                  value={config.token ?? ""}
                  onChange={(e) => set("token", e.target.value)}
                  placeholder="••••••"
                />
              </Field>
            </>
          ) : null}

          {type === "linear" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Linear API key">
                <input
                  className="auth-input"
                  type="password"
                  value={config.apiKey ?? ""}
                  onChange={(e) => set("apiKey", e.target.value)}
                  placeholder="lin_api_…"
                  required
                />
              </Field>
              <Field label="Team ID">
                <input
                  className="auth-input"
                  value={config.teamId ?? ""}
                  onChange={(e) => set("teamId", e.target.value)}
                  placeholder="TEAM-uuid"
                  required
                />
              </Field>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save connector
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-black/55">{label}</span>
      {children}
    </label>
  );
}
