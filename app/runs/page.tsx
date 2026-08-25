import Link from "next/link";
import { getBusinesses, getDashboard, resolveBusiness } from "@/lib/data";
import { BusinessTabs } from "@/components/nav/BusinessTabs";
import { campaignTime, dayLabel, num } from "@/lib/format";
import { StatusPill } from "@/components/data/StatusPill";
import { ExportButtons } from "@/components/data/ExportButtons";
import { EmptyState } from "@/components/ui/EmptyState";

export const revalidate = 0;
export const metadata = { title: "History · Campaign Tally" };

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const [business, businesses] = await Promise.all([resolveBusiness(b), getBusinesses()]);

  if (!business) {
    return (
      <EmptyState glyph="◇" headline="No businesses set up yet">
        <Link href="/settings">Go to settings</Link>
      </EmptyState>
    );
  }

  const d = await getDashboard(business);
  const query = `?b=${encodeURIComponent(business.slug)}`;

  if (d.runs.length === 0) {
    return (
      <EmptyState
        glyph="◌"
        headline={`No scrapes recorded for ${business.name}`}
        hint="Once a scrape runs, every one is listed here with what it found."
      >
        <Link href={`/${query}`}>Back to dashboard</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <BusinessTabs businesses={businesses} selected={business.slug} basePath="/runs" />

      <section>
        <p className="label">Scrape history</p>
        <h1 className="text-[26px] font-bold">History</h1>
        <p className="muted text-[13px]">
          {business.name} · {d.runs.length} scrape{d.runs.length === 1 ? "" : "s"} recorded
        </p>
      </section>

      <section className="card">
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th className="right">Hashtags</th>
                <th className="right">New posts</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.runs.map((run) => {
                const rows = d.rows.filter((r) => r.runId === run.id);
                const newPosts = rows.reduce((sum, r) => sum + r.newPosts, 0);
                return (
                  <tr
                    key={run.id}
                    className={run.status === "aborted" ? "shadow-[inset_3px_0_0_var(--color-danger)]" : undefined}
                  >
                    <td className="font-semibold">{dayLabel(run.day)}</td>
                    <td className="muted num">{campaignTime(run.startedAt)}</td>
                    <td className="right num">{rows.length}</td>
                    <td className="right num">{num(newPosts)}</td>
                    <td>
                      <StatusPill status={run.status} />
                    </td>
                    <td className="right">
                      <Link
                        href={`/runs/${encodeURIComponent(run.id)}${query}`}
                        className="text-[13px] font-semibold"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ExportButtons business={business.slug} hasPosts={d.distinctPosts > 0} />
    </>
  );
}
