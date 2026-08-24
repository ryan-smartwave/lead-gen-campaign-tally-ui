import { NextResponse } from "next/server";
import { clearFinished, snapshot } from "@/lib/runManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The replayable snapshot. A client that just started a run and a client that
 * reloaded twenty minutes later both call this, then reduce the same events —
 * which is what makes resuming a non-event rather than a special case.
 */
export async function GET() {
  return NextResponse.json(snapshot());
}

/**
 * Dismisses a finished run's progress panel. Refuses while a run is live; the
 * collected results are unaffected either way, since they live in the scraper's
 * files and the database rather than in this log.
 */
export async function DELETE() {
  const cleared = clearFinished();
  return NextResponse.json(
    cleared
      ? { cleared: true }
      : { cleared: false, message: "A run is still in progress." },
    { status: cleared ? 200 : 409 },
  );
}
