import { NextResponse } from "next/server";
import * as scraper from "@/lib/scraperClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof scraper.ScraperUnavailableError) {
    return NextResponse.json({ error: "service_unavailable", message: err.message }, { status: 503 });
  }
  const e = err as NodeJS.ErrnoException & { status?: number };
  return NextResponse.json(
    { error: e.code ?? "invalid", message: e.message },
    { status: e.status ?? 400 },
  );
}

/** Renames a business and/or replaces its hashtag list. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const business = await scraper.updateBusiness(slug, {
      ...(typeof body?.name === "string" ? { name: body.name } : {}),
      ...(Array.isArray(body?.hashtags) ? { hashtags: body.hashtags } : {}),
      ...(body?.campaignStart !== undefined ? { campaignStart: body.campaignStart } : {}),
      ...(body?.campaignEnd !== undefined ? { campaignEnd: body.campaignEnd } : {}),
    });
    return NextResponse.json({ business });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Removes the definition. Collected results stay in the database, so
 * re-creating the business with the same id picks its history back up.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    await scraper.deleteBusiness(slug);
    return NextResponse.json({
      deleted: slug,
      note: "Collected results were left in place; re-creating this business with the same id restores its history.",
    });
  } catch (err) {
    return fail(err);
  }
}
