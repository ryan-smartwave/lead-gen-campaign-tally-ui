import { NextResponse } from "next/server";
import { isScraperHost, mcpEndpoint } from "@/lib/capability";
import { probeMcp } from "@/lib/mcpProbe";
import { isRunning, startRun, stop } from "@/lib/runManager";
import { getDashboard, ranTodayForReal, resolveBusiness } from "@/lib/data";
import { campaignDay } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUSY_HINT =
  'mcp-chrome already holds a session. Reset it: open chrome://extensions, click the reload icon on "Chrome MCP Server", reopen its popup (Service Running · Port 12306), then re-run.';

/** Starts a run. Returns as soon as it has begun; the run continues server-side. */
export async function POST(request: Request) {
  if (!isScraperHost()) {
    return NextResponse.json(
      {
        error: "not_local",
        message: "This device cannot run scrapes — it has no signed-in Chrome bridge.",
      },
      { status: 403 },
    );
  }

  if (isRunning()) {
    return NextResponse.json(
      { error: "already_running", message: "A run is already in progress." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const business = await resolveBusiness(
    typeof body?.business === "string" ? body.business : undefined,
  );
  if (!business) {
    return NextResponse.json(
      {
        error: "no_business",
        message: "Add a business with at least one hashtag before running a scrape.",
      },
      { status: 400 },
    );
  }

  // Answered from local files, not the database: a cleared or lagging mirror
  // must never re-open a second run on the same day.
  const ranToday = await ranTodayForReal(business);
  if (ranToday && !force) {
    const dashboard = await getDashboard(business);
    const aborted = dashboard.latestRun?.status === "aborted";
    return NextResponse.json(
      {
        error: aborted ? "aborted_today" : "already_ran_today",
        message: aborted
          ? "Today's run aborted on a danger signal. Running again today escalates a short block into a long one."
          : "A scrape already ran today. Running twice a day works against the anti-ban design.",
        campaignDay: campaignDay(),
        overridable: true,
      },
      { status: 409 },
    );
  }

  // Fail fast rather than start a doomed run that will just hold a lock.
  const probe = await probeMcp(mcpEndpoint());
  if (!probe.reachable) {
    return NextResponse.json(
      { error: "mcp_unreachable", message: probe.detail, hint: BUSY_HINT },
      { status: 503 },
    );
  }

  try {
    const result = await startRun(business.slug);
    return NextResponse.json({ ...result, business: business.slug }, { status: 202 });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ALREADY_RUNNING") {
      return NextResponse.json(
        { error: "already_running", message: e.message },
        { status: 409 },
      );
    }
    if (e.code === "DB_NOT_CONFIGURED") {
      // Web-driven runs write straight to Postgres and keep no local copies, so
      // there is no fallback to fall back to.
      return NextResponse.json({ error: "db_not_configured", message: e.message }, { status: 503 });
    }
    return NextResponse.json(
      {
        error: "start_failed",
        message: e.message,
        ...(/already connected to a transport/i.test(e.message) ? { hint: BUSY_HINT } : {}),
      },
      { status: 500 },
    );
  }
}

/** Cooperative stop; takes effect between hashtags rather than mid-page. */
export async function DELETE() {
  if (!isScraperHost()) {
    return NextResponse.json({ error: "not_local" }, { status: 403 });
  }
  return NextResponse.json({ stopping: stop() });
}
