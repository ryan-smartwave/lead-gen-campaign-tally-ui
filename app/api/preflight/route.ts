import { NextResponse } from "next/server";
import * as scraper from "@/lib/scraperClient";
import { resolveCampaign } from "@/lib/data";
import { campaignDay } from "@/lib/format";
import type { Check, Preflight } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Translates the scraper service's preflight into what the UI renders.
 *
 * Whether this device can run a scrape is simply whether the service is
 * reachable — the service only exists on the machine with the signed-in Chrome.
 * That makes capability an observed fact rather than a configuration flag.
 *
 * Always answers 200: this endpoint reports problems, it does not fail.
 */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("campaign") ?? undefined;

  let service: scraper.ServicePreflight | null = null;
  let unreachable: string | null = null;
  try {
    service = await scraper.preflight(requested);
  } catch (err) {
    unreachable = (err as Error).message;
  }

  const campaign = await resolveCampaign(requested);
  const checks: Check[] = [];

  if (unreachable || !service) {
    checks.push({
      id: "mcp",
      status: "fail",
      label: "Scraper service",
      detail: unreachable ?? "The scraper service did not answer.",
      remedy: "mcp_unreachable",
    });
  } else {
    const mcp = service.checks.mcp;
    checks.push({
      id: "mcp",
      status: mcp?.state === "ok" ? "pass" : "fail",
      label: "Chrome connection",
      detail: mcp?.detail ?? "unknown",
      ...(mcp?.state === "ok" ? {} : { remedy: "mcp_unreachable" as const }),
    });

    const db = service.checks.database;
    if (db?.state !== "ok") {
      checks.push({
        id: "sessions",
        status: "fail",
        label: "Scraper database",
        detail: db?.detail ?? "The scraper has no database configured.",
      });
    } else {
      checks.push({
        id: "sessions",
        status: "not_checked",
        label: "Instagram and Facebook sign-in",
        detail:
          "Not checked. Verifying this visits both sites for real, so it runs only when you ask.",
      });
    }

    const today = service.checks.today;
    checks.push({
      id: "today",
      status: today?.state === "warn" ? "warn" : "pass",
      label: "Once per day",
      detail: campaign
        ? `${campaign.name}: ${today?.detail ?? "unknown"}`
        : (today?.detail ?? `no run yet today (${campaignDay()})`),
    });

    // Shown only as a warning: "everything fits" is the unremarkable default.
    const coverage = service.checks.coverage;
    if (coverage?.state === "warn") {
      checks.push({
        id: "coverage",
        status: "warn",
        label: "Hashtag coverage",
        detail: coverage.detail,
      });
    }
  }

  const body: Preflight & { blockedBy: scraper.BlockedBy; serviceReachable: boolean } = {
    capability: unreachable ? "hosted" : "local",
    canRun: Boolean(service?.canRun),
    blockedBy: service?.blockedBy ?? "config_invalid",
    serviceReachable: !unreachable,
    checks,
  };

  return NextResponse.json(body);
}
