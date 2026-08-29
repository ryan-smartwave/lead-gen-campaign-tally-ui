import { getAllPosts, getDashboard, resolveBusiness } from "@/lib/data";
import { exportFilename, postsCsv, runsCsv, talliesCsv } from "@/lib/csv";
import { campaignDay } from "@/lib/format";

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
    return new Response("No campaign configured.", { status: 404 });
  }

  const data = await getDashboard(business);
  let body: string;

  if (kind === "posts") {
    body = postsCsv(await getAllPosts(business.slug));
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
