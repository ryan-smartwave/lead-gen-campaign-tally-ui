import { NextResponse } from "next/server";
import { isScraperHost, mcpEndpoint } from "@/lib/capability";
import { probeMcp } from "@/lib/mcpProbe";
import { activeBusiness, isRunning } from "@/lib/runManager";
import { getDashboard, ranTodayForReal, resolveBusiness } from "@/lib/data";
import { campaignDay } from "@/lib/format";
import type { Check, Preflight } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The free checks only. This route never contacts Instagram or Facebook — the
 * session check costs real page visits and so lives behind its own explicit
 * action. Always answers 200: it reports failures rather than failing.
 */
export async function GET(request: Request) {
  const local = isScraperHost();
  const requested = new URL(request.url).searchParams.get("business") ?? undefined;
  const business = await resolveBusiness(requested);
  const today = campaignDay();
  const checks: Check[] = [];

  if (local) {
    const probe = await probeMcp(mcpEndpoint());
    checks.push({
      id: "mcp",
      status: probe.reachable ? "pass" : "fail",
      label: "Chrome connection",
      detail: probe.reachable
        ? `Bridge reachable — ${probe.detail}`
        : `Cannot reach the bridge: ${probe.detail}`,
      ...(probe.reachable ? {} : { remedy: "mcp_unreachable" as const }),
    });
  } else {
    checks.push({
      id: "mcp",
      status: "not_checked",
      label: "Chrome connection",
      detail: "Not applicable on this device — scrapes run on the laptop.",
    });
  }

  checks.push({
    id: "sessions",
    status: "not_checked",
    label: "Instagram and Facebook sign-in",
    detail:
      "Not checked. Verifying this visits both sites for real, so it runs only when you ask.",
  });

  const dashboard = business ? await getDashboard(business) : null;
  // From local files, matching the guard that actually blocks the run — the
  // warning shown must never disagree with what enforcement will do.
  const ranToday = business ? await ranTodayForReal(business) : false;
  checks.push({
    id: "today",
    status: ranToday ? "warn" : "pass",
    label: "Once per day",
    detail: !business
      ? "No business configured yet."
      : ranToday
        ? `${business.name} was already scraped today (${today}). Running twice a day works against the anti-ban design.`
        : `No scrape yet today (${today}) for ${business.name}.`,
  });

  const mcpOk = checks.find((c) => c.id === "mcp")?.status === "pass";
  const running = isRunning();
  const lastRun = dashboard?.latestRun ?? null;

  const body: Preflight & { business: string | null; runningBusiness: string | null } = {
    capability: local ? "local" : "hosted",
    canRun: local && mcpOk && !running && Boolean(business?.hashtags.length),
    checks,
    business: business?.slug ?? null,
    runningBusiness: activeBusiness(),
    ...(running ? { activeRunId: "active" } : {}),
    ...(lastRun
      ? {
          lastRun: {
            id: lastRun.id,
            day: lastRun.day,
            status: lastRun.status,
            startedAt: lastRun.startedAt,
          },
        }
      : {}),
  };

  return NextResponse.json(body);
}
