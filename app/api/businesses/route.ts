import { NextResponse } from "next/server";
import { isScraperHost } from "@/lib/capability";
import * as local from "@/lib/localStore";
import { getBusinesses } from "@/lib/data";
import { syncBusinesses } from "@/lib/sync";
import { isDbConfigured } from "@/lib/db";
import type { Target } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Businesses and their hashtag lists.
 *
 * Writes go to the scraper's own files, which keeps the CLI and the web app
 * reading the same definitions — there is no second source of truth to drift.
 * Only the machine holding those files may write, and `safety` settings are
 * deliberately not editable here: hashtags are content, safety is the anti-ban
 * firewall.
 */

export async function GET() {
  return NextResponse.json({ businesses: await getBusinesses(), editable: isScraperHost() });
}

export async function POST(request: Request) {
  if (!isScraperHost()) {
    return NextResponse.json(
      {
        error: "not_local",
        message: "Businesses can only be edited on the machine that holds the scraper.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const hashtags: Target[] = Array.isArray(body?.hashtags) ? body.hashtags : [];
  const slug = (typeof body?.slug === "string" && body.slug) || local.slugify(name);

  if (!name) {
    return NextResponse.json(
      { error: "invalid", message: "Give the business a name." },
      { status: 400 },
    );
  }
  if (!slug) {
    return NextResponse.json(
      {
        error: "invalid",
        message: "That name has no letters or digits to build an id from — try another.",
      },
      { status: 400 },
    );
  }
  if (!body?.slug && local.readBusiness(slug)) {
    return NextResponse.json(
      { error: "exists", message: `A business with the id "${slug}" already exists.` },
      { status: 409 },
    );
  }

  try {
    const saved = local.writeBusiness({ slug, name, hashtags });
    // Mirror to the database so the hosted copy sees it too. Never fatal.
    if (isDbConfigured()) await syncBusinesses().catch(() => {});
    return NextResponse.json({ business: saved });
  } catch (err) {
    return NextResponse.json(
      { error: "invalid", message: (err as Error).message },
      { status: 400 },
    );
  }
}
