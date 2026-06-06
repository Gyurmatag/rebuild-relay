"use client";

import { useState } from "react";
import { Loader2, PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "signin"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name || email.split("@")[0] });
      if (res.error) {
        setError(res.error.message ?? "Authentication failed.");
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[100svh] place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-sm bg-black" />
          RebuildRelay
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white/85 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mb-6 flex justify-center">
            <div className="orb grid h-20 w-20 place-items-center bg-[radial-gradient(circle_at_30%_20%,#fff_0,#ff7a88_24%,#7f73ff_54%,#a2b978_100%)]">
              <PhoneCall className="relative z-10 h-6 w-6 text-white drop-shadow" />
            </div>
          </div>

          <h1 className="text-center text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-center text-sm text-black/55">
            {mode === "signin" ? "Sign in to the operations console." : "Set up access to the operations console."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "signup" ? (
              <Field label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Dispatcher"
                  className="auth-input"
                  autoComplete="name"
                />
              </Field>
            ) : null}
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="auth-input"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="auth-input"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </Field>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <Button type="submit" size="lg" disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-black/55">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="font-medium text-black underline-offset-4 hover:underline"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
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
