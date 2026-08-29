import Link from "next/link";
import { getCampaigns, getDashboard, resolveCampaign } from "@/lib/data";
import { CampaignTabs } from "@/components/nav/CampaignTabs";
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
  const [campaign, campaigns, local] = await Promise.all([
    resolveCampaign(b),
    getCampaigns(),
    canRunScrapes(),
  ]);

  if (!campaign) {
    return (
      <EmptyState
        glyph="◇"
        headline="No campaigns set up yet"
        hint={
          local
            ? "Add a campaign in Settings and give it the hashtags you want tracked."
            : "Campaigns are set up on the machine that runs the scraper."
        }
      >
        <Link href="/settings">Go to settings</Link>
      </EmptyState>
    );
  }

  const d = await getDashboard(campaign);

  const latestRows = d.latestRun ? d.rows.filter((r) => r.runId === d.latestRun!.id) : [];
  const latestNew = latestRows.reduce((sum, r) => sum + r.newPosts, 0);
  const latestFresh = latestRows.reduce((sum, r) => sum + r.freshPosts, 0);
  // Only meaningful once a campaign window is set — otherwise fresh == new.
  const hasCampaignWindow = Boolean(campaign.campaignStart || campaign.campaignEnd);

  return (
    <>
      <CampaignTabs campaigns={campaigns} selected={campaign.slug} basePath="/" />

      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label">Campaign dashboard</p>
          <h1 className="text-[26px] font-bold">{campaign.name}</h1>
          {d.latestRun ? (
            <p className="muted text-[13px]">
              Last scrape {runStamp(d.latestRun.startedAt)} · {latestRows.length} hashtag
              {latestRows.length === 1 ? "" : "s"} ·{" "}
              <Link
                href={`/runs/${encodeURIComponent(d.latestRun.id)}?b=${encodeURIComponent(campaign.slug)}`}
              >
                view run
              </Link>
            </p>
          ) : (
            <p className="muted text-[13px]">No scrapes recorded yet.</p>
          )}
        </div>
        {d.latestRun ? <StatusPill status={d.latestRun.status} /> : null}
      </section>

      <RunLauncher
        canRun={local && campaign.hashtags.length > 0}
        local={local}
        ranToday={d.ranToday}
        campaign={campaign.slug}
        hashtagCount={campaign.hashtags.length}
      />

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
            <StatTile label="Unique posts" value={d.distinctPosts} accent="var(--color-accent)" />
            <StatTile label="Found last run" value={latestNew} />
            {hasCampaignWindow ? (
              <StatTile
                label="In-campaign last run"
                value={latestFresh}
                accent="var(--color-ok)"
                qualifier="within the campaign window"
              />
            ) : null}
            <StatTile
              label="Instagram"
              value={d.tallied.instagram}
              accent="var(--color-instagram)"
              qualifier="tallied"
            />
            <StatTile
              label="Facebook"
              value={d.tallied.facebook}
              accent="var(--color-facebook)"
              qualifier="tallied"
            />
          </section>

          {/* Trends before detail: the shape of the campaign reads first, the
              per-hashtag breakdown supports it. */}
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
                <p className="muted text-xs">
                  Posts are deduplicated for the life of the campaign, so this naturally falls as
                  coverage saturates. The cumulative chart is the headline signal.
                </p>
              </section>
            </div>
          )}

          <section className="card">
            <div className="row justify-between">
              <span className="card-title">By hashtag</span>
              <span className="muted text-xs">
                {num(d.tallied.tallied)} tallied across hashtags · {num(d.distinctPosts)} distinct
                posts
              </span>
            </div>
            <HashtagTable
              series={d.series}
              latestRows={latestRows}
              configuredOnly={d.configuredOnly}
            />
            <p className="muted text-xs">
              A post can carry several campaign hashtags, so the per-hashtag column adds up to more
              than the distinct total. Both numbers are real; they answer different questions.
            </p>
          </section>

          <div className="grid-2">
            <section className="card">
              <div className="row justify-between">
                <span className="card-title">Recent scrapes</span>
                <Link href={`/runs?b=${encodeURIComponent(campaign.slug)}`} className="text-[13px]">
                  All history →
                </Link>
              </div>
              <div className="flex flex-col">
                {d.runs.slice(0, 5).map((run) => {
                  const rows = d.rows.filter((r) => r.runId === run.id);
                  return (
                    <Link
                      key={run.id}
                      href={`/runs/${encodeURIComponent(run.id)}?b=${encodeURIComponent(campaign.slug)}`}
                      className="list-row justify-between"
                    >
                      <span className="font-semibold">{dayLabel(run.day)}</span>
                      <span className="muted num text-[13px]">
                        {rows.length} hashtag{rows.length === 1 ? "" : "s"} · +
                        {num(rows.reduce((s, r) => s + r.newPosts, 0))}
                      </span>
                      <StatusPill status={run.status} />
                    </Link>
                  );
                })}
              </div>
            </section>

            <ExportButtons campaign={campaign.slug} hasPosts={d.distinctPosts > 0} />
          </div>
        </>
      )}
    </>
  );
}
