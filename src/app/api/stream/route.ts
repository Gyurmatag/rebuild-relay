import { getEnv } from "@/lib/cf";
import { getDispatchStats, getEventsSince, listIncidents, listTicketEvents } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream powering the live dashboard. The browser opens one
 * EventSource; the server tails the D1 audit log and pushes `activity` and
 * fresh `snapshot` events the moment anything changes — from any channel,
 * isolate, or tool call. Closes after a bounded lifetime so the client's
 * built-in reconnect keeps the stream healthy.
 */
export async function GET(request: Request) {
  const env = await getEnv();
  const encoder = new TextEncoder();
  let cursor = new Date(0).toISOString();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      request.signal.addEventListener("abort", () => {
        closed = true;
      });

      try {
        const [incidents, stats, events] = await Promise.all([
          listIncidents(env, 50),
          getDispatchStats(env),
          listTicketEvents(env, 40),
        ]);
        send("snapshot", { incidents, stats });
        send("activity", { events });
        if (events.length) cursor = events[events.length - 1].createdAt;
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "stream init failed" });
      }

      const maxTicks = 100; // ~2.5 min, then the client reconnects.
      for (let tick = 0; tick < maxTicks && !closed && !request.signal.aborted; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (closed || request.signal.aborted) break;
        try {
          const newEvents = await getEventsSince(env, cursor, 50);
          if (newEvents.length) {
            cursor = newEvents[newEvents.length - 1].createdAt;
            send("activity", { events: newEvents });
            const [incidents, stats] = await Promise.all([listIncidents(env, 50), getDispatchStats(env)]);
            send("snapshot", { incidents, stats });
          } else {
            controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          }
        } catch {
          // Transient D1 hiccup — keep the connection open and retry next tick.
        }
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
