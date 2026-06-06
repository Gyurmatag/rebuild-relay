import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/dashboard/app-nav";
import { RealtimeProvider, type Stats } from "@/components/dashboard/realtime";
import { createAuth } from "@/lib/auth";
import { getEnv, readVar } from "@/lib/cf";
import { getDispatchStats, listIncidents, listTicketEvents } from "@/lib/db";
import type { Incident, TicketEvent } from "@/lib/incident-schema";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const env = await getEnv();

  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) {
    redirect("/login");
  }

  const phone = readVar(env, "TWILIO_PHONE_NUMBER") ?? "";
  let incidents: Incident[] = [];
  let stats: Stats | null = null;
  let events: TicketEvent[] = [];
  try {
    [incidents, stats, events] = await Promise.all([
      listIncidents(env, 50),
      getDispatchStats(env),
      listTicketEvents(env, 60),
    ]);
  } catch {
    // Data load failed — render an empty shell; realtime will populate it.
  }

  return (
    <RealtimeProvider phone={phone} initialIncidents={incidents} initialStats={stats} initialEvents={events}>
      <div className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <AppNav email={session.user.email} phone={phone} />
          <main className="mt-8">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
