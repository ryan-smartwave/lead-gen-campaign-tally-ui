import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosts, getRun, resolveBusiness } from "@/lib/data";
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
  const business = await resolveBusiness(b);
  if (!business) notFound();

  const detail = await getRun(business, runId);
  if (!detail) notFound();

  const { run, rows, neverVisited, totals } = detail;

  // Resolve every hashtag's posts up front; they can't be fetched inside JSX.
  const groups = await Promise.all(
    rows
      .filter((r) => r.newPosts > 0)
      .map(async (row) => ({
        row,
        posts: await getPosts(business.slug, row.platform, row.hashtag, 60),
      })),
  );

  return (
    <>
      <section className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="muted" style={{ fontSize: 13 }}>
            <Link href={`/runs?b=${encodeURIComponent(business.slug)}`}>← History</Link>
            {" · "}
            <span>{business.name}</span>
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {dayLabel(run.day)} at {campaignTime(run.startedAt)}
          </h1>
          <p className="muted" style={{ fontSize: 13 }}>
            {rows.length} hashtags visited · {num(totals.newPosts)} new posts found
          </p>
        </div>
        <StatusPill status={run.status} />
      </section>

      {run.status === "aborted" ? (
        <section
          role="alert"
          className="card"
          style={{ borderLeft: "3px solid var(--danger)", background: "var(--danger-bg)" }}
        >
          <strong style={{ color: "var(--danger)" }}>This run stopped early</strong>
          <p style={{ fontSize: 13 }}>
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
                    <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <PlatformIcon platform={row.platform} />
                      <span style={{ fontWeight: 600 }}>#{row.hashtag}</span>
                    </span>
                  </td>
                  <td className="right num">+{num(row.newPosts)}</td>
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
          <p className="muted" style={{ fontSize: 12 }}>
            An empty hashtag usually means the platform is restricting that tag, not that the
            scrape failed.
          </p>
        ) : null}
        {neverVisited.length > 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>
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
