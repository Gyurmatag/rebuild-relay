"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall } from "lucide-react";

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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="space-y-3">
      <nav className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-sm bg-black" />
          RebuildRelay
        </Link>

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

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline-flex">
            <LiveBadge connected={connected} />
          </span>
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
      </nav>

      {/* Mobile tabs */}
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
              isActive(link.href)
                ? "border-black bg-black text-white"
                : "border-black/10 bg-white text-black/60",
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
