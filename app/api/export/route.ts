import { dataSource, getDashboard, getPosts, resolveBusiness } from "@/lib/data";
import * as remote from "@/lib/dbStore";
import { exportFilename, postsCsv, runsCsv, talliesCsv } from "@/lib/csv";
import { campaignDay } from "@/lib/format";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV download. `kind` selects what to export:
 *   tallies — one row per hashtag per run (the time series)
 *   runs    — one row per scrape (the summary)
 *   posts   — one row per post, with captions
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "tallies";
  const business = await resolveBusiness(params.get("business") ?? undefined);

  if (!business) {
    return new Response("No business configured.", { status: 404 });
  }

  const data = await getDashboard(business);
  let body: string;

  if (kind === "posts") {
    let posts: Post[];
    if (dataSource() === "database") {
      posts = await remote.readAllPosts(business.slug);
    } else {
      // Locally, posts live in one file per hashtag.
      const pairs = new Map(
        data.rows.map((r) => [`${r.platform}:${r.hashtag}`, r] as const),
      );
      const groups = await Promise.all(
        [...pairs.values()].map((r) =>
          getPosts(business.slug, r.platform, r.hashtag, 100_000),
        ),
      );
      posts = groups.flat();
    }
    body = postsCsv(posts);
  } else if (kind === "runs") {
    body = runsCsv(data.runs, data.rows);
  } else {
    body = talliesCsv(data.rows, data.runs);
  }

  const filename = exportFilename(business.slug, kind, campaignDay());
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
