import { eventsUrl } from "@/lib/scraperClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies the scraper service's event stream.
 *
 * Proxied rather than connected to directly so the browser only ever talks to
 * this app's own origin: no cross-origin setup, and the service's address stays
 * a server-side detail rather than something shipped to the client.
 */
export async function GET(request: Request) {
  const since = Number(new URL(request.url).searchParams.get("sinceSeq") ?? 0);

  let upstream: Response;
  try {
    upstream = await fetch(eventsUrl(since), {
      headers: { Accept: "text/event-stream" },
      // Must not be buffered or cached: the point is a live stream.
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    // No service, no stream. Closing cleanly lets the client fall back to
    // polling the snapshot rather than retrying a broken socket forever.
    return new Response("event: bye\ndata: {}\n\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("event: bye\ndata: {}\n\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
