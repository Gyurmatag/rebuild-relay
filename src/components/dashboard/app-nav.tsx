"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PhoneCall, X } from "lucide-react";

import { UserMenu } from "@/components/auth/user-menu";
import { LiveBadge } from "@/components/dashboard/live-badge";
import { useRealtime } from "@/components/dashboard/realtime";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview" },
  { href: "/tickets", label: "Tickets" },
  { href: "/activity", label: "Activity" },
  { href: "/intake", label: "Voice intake" },
];

export function AppNav({ email, phone }: { email: string; phone: string }) {
  const pathname = usePathname();
  const { connected } = useRealtime();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <nav className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-sm bg-black" />
          RebuildRelay
        </Link>

        {/* Desktop: centered pill tabs */}
        <div className="hidden items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 shadow-sm md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                isActive(link.href) ? "bg-black text-white shadow-sm" : "text-black/60 hover:text-black",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop: right-side controls */}
        <div className="hidden items-center gap-3 md:flex">
          <LiveBadge connected={connected} />
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="hidden items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black/85 lg:inline-flex"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              {phone}
            </a>
          ) : null}
          <UserMenu email={email} />
        </div>

        {/* Mobile: hamburger on the right */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile: dropdown menu panel */}
      {open ? (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <div
            id="mobile-menu"
            className="absolute right-0 top-14 z-50 w-64 origin-top-right rounded-2xl border border-black/10 bg-white p-2 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
          >
            <div className="flex flex-col">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive(link.href) ? "bg-black text-white" : "text-black/70 hover:bg-black/[0.04]",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="my-2 border-t border-black/10" />

            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-xs text-black/45">Status</span>
              <LiveBadge connected={connected} />
            </div>

            {phone ? (
              <a
                href={`tel:${phone}`}
                className="mt-1 flex items-center gap-2 rounded-xl bg-black px-3 py-2.5 text-sm font-medium text-white"
              >
                <PhoneCall className="h-4 w-4" />
                {phone}
              </a>
            ) : null}

            <div className="mt-2 border-t border-black/10 pt-2">
              <div className="px-1">
                <p className="mb-1.5 truncate px-2 text-xs text-black/45">{email}</p>
                <UserMenu email={email} hideEmail />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
