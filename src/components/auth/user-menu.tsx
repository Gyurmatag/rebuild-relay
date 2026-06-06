"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { signOut } from "@/lib/auth-client";

export function UserMenu({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[12rem] truncate text-sm text-black/60 sm:inline">{email}</span>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-black/[0.04] disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  );
}
