import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosts, getRun, resolveCampaign } from "@/lib/data";
import { campaignTime, dayLabel, num } from "@/lib/format";
import { StatusPill } from "@/components/data/StatusPill";
import { PlatformIcon } from "@/components/data/PlatformIcon";
import { PostGroup } from "@/components/posts/PostGroup";

export const revalidate = 0;

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ b?: string }>;
}) {
  const [{ id }, { b }] = await Promise.all([params, searchParams]);
  const runId = decodeURIComponent(id);
  const campaign = await resolveCampaign(b);
  if (!campaign) notFound();

  const detail = await getRun(campaign, runId);
  if (!detail) notFound();

  const { run, rows, neverVisited, totals } = detail;

  // Resolve every hashtag's posts up front; they can't be fetched inside JSX.
  const groups = await Promise.all(
    rows
      .filter((r) => r.newPosts > 0)
      .map(async (row) => ({
        row,
        posts: await getPosts(campaign.slug, row.platform, row.hashtag, 60),
      })),
  );

  return (
    <>
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="muted text-[13px]">
            <Link href={`/runs?b=${encodeURIComponent(campaign.slug)}`}>← History</Link>
            {" · "}
            <span>{campaign.name}</span>
          </p>
          <h1 className="text-[26px] font-bold">
            {dayLabel(run.day)} at {campaignTime(run.startedAt)}
          </h1>
          <p className="muted text-[13px]">
            {rows.length} hashtags visited · {num(totals.newPosts)} new posts found
          </p>
        </div>
        <StatusPill status={run.status} />
      </section>

      {run.status === "aborted" ? (
        <section role="alert" className="card border-l-[3px] border-l-danger bg-danger-bg">
          <strong className="text-danger">This run stopped early</strong>
          <p className="text-[13px]">
            A danger signal appeared, so the run aborted rather than pushing on. Whatever it had
            already collected was kept — the numbers below are partial.
          </p>
        </section>
      ) : null}

      <section className="card">
        <span className="card-title">Per hashtag</span>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Hashtag</th>
                <th className="right">New</th>
                <th className="right">Total for tag</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.platform}:${row.hashtag}`}>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <PlatformIcon platform={row.platform} />
                      <span className="font-semibold">#{row.hashtag}</span>
                    </span>
                  </td>
                  <td className="right num">
                    +{num(row.newPosts)}
                    {row.freshPosts !== row.newPosts ? (
                      <span className="muted text-xs"> ({num(row.freshPosts)} in-campaign)</span>
                    ) : null}
                  </td>
                  <td className="right num">{num(row.cumulativeUnique)}</td>
                  <td>
                    <StatusPill status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.some((r) => r.status === "empty") ? (
          <p className="muted text-xs">
            An empty hashtag usually means the platform is restricting that tag, not that the
            scrape failed.
          </p>
        ) : null}
        {neverVisited.length > 0 ? (
          <p className="muted text-xs">
            {/* Platform must be named: the same hashtag exists on both platforms, so
                "#weddingsph" alone reads as contradicting the table above. */}
            Not part of this run:{" "}
            {neverVisited.map((h) => `#${h.hashtag} on ${h.platform}`).join(", ")} — targets are
            shuffled and capped each run, so these go first next time.
          </p>
        ) : null}
      </section>

      <section className="stack">
        <span className="card-title">Posts found</span>
        {groups.length === 0 ? (
          <p className="muted text-[13px]">
            No new posts in this run — every post on the visited pages had already been tallied on
            an earlier day.
          </p>
        ) : null}
        {groups.map(({ row, posts }) => (
          <PostGroup
            key={`${row.platform}:${row.hashtag}`}
            platform={row.platform}
            hashtag={row.hashtag}
            count={row.newPosts}
            posts={posts}
          />
        ))}
      </section>
    </>
  );
}
