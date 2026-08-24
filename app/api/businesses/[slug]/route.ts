import { NextResponse } from "next/server";
import { isScraperHost } from "@/lib/capability";
import * as local from "@/lib/localStore";
import { syncBusinesses } from "@/lib/sync";
import { isDbConfigured } from "@/lib/db";
import type { Target } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard() {
  if (isScraperHost()) return null;
  return NextResponse.json(
    {
      error: "not_local",
      message: "Businesses can only be edited on the machine that holds the scraper.",
    },
    { status: 403 },
  );
}

/** Renames a business and/or replaces its hashtag list. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const blocked = guard();
  if (blocked) return blocked;

  const { slug } = await params;
  const existing = local.readBusiness(slug);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.name;
  const hashtags: Target[] = Array.isArray(body?.hashtags) ? body.hashtags : existing.hashtags;

  try {
    const saved = local.writeBusiness({ slug, name, hashtags });
    if (isDbConfigured()) await syncBusinesses().catch(() => {});
    return NextResponse.json({ business: saved });
  } catch (err) {
    return NextResponse.json(
      { error: "invalid", message: (err as Error).message },
      { status: 400 },
    );
  }
}

/**
 * Removes the business definition. Its collected data stays on disk, so this is
 * recoverable — re-creating the business with the same id picks the history back
 * up.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const blocked = guard();
  if (blocked) return blocked;

  const { slug } = await params;
  if (!local.readBusiness(slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  local.deleteBusiness(slug);
  return NextResponse.json({
    deleted: slug,
    note: "Collected data was left on disk; re-creating this business with the same id restores its history.",
  });
}
