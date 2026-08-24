import { NextResponse } from "next/server";
import * as scraper from "@/lib/scraperClient";
import { getBusinesses } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Businesses and their hashtag lists.
 *
 * Reads come from Postgres, which the service mirrors on every change, so the
 * hosted copy works too. Writes go to the service, which owns the config files —
 * one source of truth, and this app never touches the filesystem.
 *
 * Safety limits are deliberately not editable through any route: hashtags are
 * content, safety is the anti-ban firewall.
 */
export async function GET() {
  const reachable = await scraper.serviceReachable();
  return NextResponse.json({ businesses: await getBusinesses(), editable: reachable });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    const business = await scraper.createBusiness(
      typeof body?.name === "string" ? body.name : "",
      Array.isArray(body?.hashtags) ? body.hashtags : [],
    );
    return NextResponse.json({ business });
  } catch (err) {
    if (err instanceof scraper.ScraperUnavailableError) {
      return NextResponse.json({ error: "service_unavailable", message: err.message }, { status: 503 });
    }
    const e = err as NodeJS.ErrnoException & { status?: number };
    return NextResponse.json(
      { error: e.code ?? "invalid", message: e.message },
      { status: e.status ?? 400 },
    );
  }
}
