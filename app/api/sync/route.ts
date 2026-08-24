import { NextResponse } from "next/server";
import { isScraperHost } from "@/lib/capability";
import { isDbConfigured } from "@/lib/db";
import { syncToDatabase } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mirrors local results into Postgres so they can be read from another device.
 * Only the local instance can do this — it is the only one with the files.
 */
export async function POST() {
  if (!isScraperHost()) {
    return NextResponse.json(
      { error: "not_local", message: "Only the machine holding the scraper files can sync." },
      { status: 403 },
    );
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        error: "db_not_configured",
        message:
          "No DATABASE_URL set. Create a free Neon project, add its connection string to web/.env.local, then run npm run db:migrate.",
      },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json(await syncToDatabase());
  } catch (err) {
    return NextResponse.json(
      { error: "sync_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}
