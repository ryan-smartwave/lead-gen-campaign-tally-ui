import { snapshot, subscribe } from "@/lib/runManager";
import type { RunEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-sent events for the live run.
 *
 * The keep-alive ping is not optional: gaps between hashtags are 3–7 minutes by
 * design, which exceeds common idle timeouts, and a dropped stream during a
 * deliberate silence looks exactly like a crashed run.
 */
export async function GET(request: Request) {
  const since = Number(new URL(request.url).searchParams.get("sinceSeq") ?? 0);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let open = true;
      const send = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      };

      const frame = (event: RunEvent) =>
        send(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

      const snap = snapshot();
      send(
        `event: hello\ndata: ${JSON.stringify({
          firstSeq: snap.firstSeq,
          lastSeq: snap.lastSeq,
          active: snap.active,
        })}\n\n`,
      );
      for (const event of snap.events) {
        if (event.seq > since) frame(event);
      }

      const unsubscribe = subscribe(frame);
      const ping = setInterval(() => send(`: ping\n\n`), 20_000);

      const close = () => {
        open = false;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
