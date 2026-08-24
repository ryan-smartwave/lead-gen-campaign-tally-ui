import { NextResponse } from "next/server";
import * as scraper from "@/lib/scraperClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The replayable snapshot, from the scraper service.
 *
 * A client that just started a run and one that reloaded twenty minutes later
 * both call this and reduce the same events, which is what makes resuming a
 * non-event rather than a special case. Because the snapshot lives in the
 * service, it also survives this app restarting mid-run.
 */
export async function GET() {
  try {
    return NextResponse.json(await scraper.runSnapshot());
  } catch {
    // An unreachable service simply means nothing is running here; the preflight
    // endpoint is where that gets explained.
    return NextResponse.json({
      active: false,
      runId: null,
      business: null,
      startedAt: null,
      firstSeq: 0,
      lastSeq: 0,
      events: [],
      lastError: null,
    });
  }
}

/** Dismisses a finished run's log (the service refuses while one is live). */
export async function DELETE() {
  try {
    return NextResponse.json(await scraper.stopRun());
  } catch (err) {
    return NextResponse.json(
      { cleared: false, message: (err as Error).message },
      { status: 503 },
    );
  }
}
