import { NextResponse } from "next/server";
import * as scraper from "@/lib/scraperClient";
import { resolveBusiness } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a run by asking the scraper service to start one.
 *
 * The run then lives in the service's process, so restarting or rebuilding this
 * app cannot kill a scrape in flight — which is the main reason the scraper is a
 * service rather than a library imported here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const business = await resolveBusiness(
    typeof body?.business === "string" ? body.business : undefined,
  );

  if (!business) {
    return NextResponse.json(
      {
        error: "no_business",
        message: "Add a campaign with at least one hashtag before running a scrape.",
      },
      { status: 400 },
    );
  }

  try {
    const started = await scraper.startRun(business.slug, body?.force === true);
    return NextResponse.json(started, { status: 202 });
  } catch (err) {
    if (err instanceof scraper.ScraperUnavailableError) {
      return NextResponse.json({ error: "service_unavailable", message: err.message }, { status: 503 });
    }
    const e = err as NodeJS.ErrnoException & { status?: number; hint?: string };
    // The service already decided the right refusal; pass it through unchanged
    // so the UI's copy and the enforcement never disagree.
    return NextResponse.json(
      { error: e.code ?? "start_failed", message: e.message, ...(e.hint ? { hint: e.hint } : {}) },
      { status: e.status ?? 500 },
    );
  }
}

/** Stops a live run, or dismisses a finished one's progress panel. */
export async function DELETE() {
  try {
    return NextResponse.json(await scraper.stopRun());
  } catch (err) {
    if (err instanceof scraper.ScraperUnavailableError) {
      return NextResponse.json({ error: "service_unavailable", message: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "stop_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}
