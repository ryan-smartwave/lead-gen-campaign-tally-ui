import Link from "next/link";
import { getDashboard, resolveBusiness } from "@/lib/data";
import { ExportButtons } from "@/components/data/ExportButtons";
import { canRunScrapes } from "@/lib/capability";
import { dayLabel, num, runStamp } from "@/lib/format";
import { StatTile } from "@/components/data/StatTile";
import { HashtagTable } from "@/components/data/HashtagTable";
import { StatusPill } from "@/components/data/StatusPill";
import { NewPostsBars } from "@/components/charts/NewPostsBars";
import { CumulativeChart } from "@/components/charts/CumulativeChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { RunLauncher } from "@/components/run/RunLauncher";

// The local instance wants to see the row that just landed; a hosted read-only
// instance should not wake the database on every glance.
export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const [business, local] = await Promise.all([resolveBusiness(b), canRunScrapes()]);

  if (!business) {
    return (
      <EmptyState
        glyph="◇"
        headline="No businesses set up yet"
        hint={
          local
            ? "Add a business in Settings and give it the hashtags you want tracked."
            : "Businesses are set up on the machine that runs the scraper."
        }
      >
        <Link href="/settings">Go to settings</Link>
      </EmptyState>
    );
  }

  const d = await getDashboard(business);

  const latestRows = d.latestRun ? d.rows.filter((r) => r.runId === d.latestRun!.id) : [];
  const latestNew = latestRows.reduce((sum, r) => sum + r.newPosts, 0);

  return (
    <>
      <section className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {business.name}
          </h1>
          {d.latestRun ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Last scrape {runStamp(d.latestRun.startedAt)} · {latestRows.length} hashtags ·{" "}
              <Link
                href={`/runs/${encodeURIComponent(d.latestRun.id)}?b=${encodeURIComponent(business.slug)}`}
              >
                view run
              </Link>
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              No scrapes recorded yet.
            </p>
          )}
        </div>
        {d.latestRun ? <StatusPill status={d.latestRun.status} /> : null}
      </section>

      <RunLauncher
        canRun={local && business.hashtags.length > 0}
        ranToday={d.ranToday}
        business={business.slug}
        hashtagCount={business.hashtags.length}
      />
      {d.runs.length > 0 ? (
        <ExportButtons business={business.slug} hasPosts={d.distinctPosts > 0} />
      ) : null}

      {/* No sync notice any more: the scraper writes results to the database as
          it goes, so there is no second copy that could be ahead of it. */}

      {d.runs.length === 0 ? (
        <EmptyState
          glyph="◌"
          headline="No scrapes recorded yet"
          hint={
            local
              ? "A run visits each hashtag in turn with long random gaps between them, so it takes 30–60 minutes. Results are written to the database as the run goes."
              : "Nothing has been scraped yet. Runs happen on the laptop where Chrome is signed in."
          }
        />
      ) : (
        <>
          <section className="tiles">
            <StatTile label="Unique posts" value={d.distinctPosts} />
            <StatTile label="Found last run" value={latestNew} />
            <StatTile
              label="Instagram"
              value={d.tallied.instagram}
              accent="var(--instagram)"
              qualifier="tallied"
            />
            <StatTile
              label="Facebook"
              value={d.tallied.facebook}
              accent="var(--facebook)"
              qualifier="tallied"
            />
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="card-title">By hashtag</span>
              <span className="muted" style={{ fontSize: 12 }}>
                {num(d.tallied.tallied)} tallied across hashtags · {num(d.distinctPosts)} distinct
                posts
              </span>
            </div>
            <HashtagTable
              series={d.series}
              latestRows={latestRows}
              configuredOnly={d.configuredOnly}
            />
            <p className="muted" style={{ fontSize: 12 }}>
              A post can carry several campaign hashtags, so the per-hashtag column adds up to more
              than the distinct total. Both numbers are real; they answer different questions.
            </p>
          </section>

          {d.runs.length < 2 ? (
            <section className="card">
              <span className="label">Trends</span>
              <p className="muted">
                Charts appear after the second scrape — a single data point cannot show a trend.
              </p>
            </section>
          ) : (
            <div className="grid-2">
              <section className="card">
                <span className="card-title">Cumulative posts per hashtag</span>
                <CumulativeChart series={d.series} />
              </section>
              <section className="card">
                <span className="card-title">Newly discovered per day</span>
                <NewPostsBars data={d.daily} flags={d.flags} />
                <p className="muted" style={{ fontSize: 12 }}>
                  Posts are deduplicated for the life of the campaign, so this naturally falls as
                  coverage saturates. The cumulative chart is the headline signal.
                </p>
              </section>
            </div>
          )}

          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="card-title">Recent scrapes</span>
              <Link href={`/runs?b=${encodeURIComponent(business.slug)}`} style={{ fontSize: 13 }}>
                All history →
              </Link>
            </div>
            <div className="stack">
              {d.runs.slice(0, 5).map((run) => {
                const rows = d.rows.filter((r) => r.runId === run.id);
                return (
                  <Link
                    key={run.id}
                    href={`/runs/${encodeURIComponent(run.id)}?b=${encodeURIComponent(business.slug)}`}
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      textDecoration: "none",
                      color: "inherit",
                      borderTop: "1px solid var(--line)",
                      paddingTop: "var(--space-3)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{dayLabel(run.day)}</span>
                    <span className="muted num" style={{ fontSize: 13 }}>
                      {rows.length} hashtags · +{num(rows.reduce((s, r) => s + r.newPosts, 0))}
                    </span>
                    <StatusPill status={run.status} />
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
