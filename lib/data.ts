import type { Business, Platform, Post, Run, Series, TallyRow } from "./types";
import * as remote from "./dbStore";
import { isDbConfigured } from "./db";
import { buildSeries, dailyNewPosts, talliedTotals } from "./series";
import { campaignDay } from "./format";

/**
 * The app's read API, scoped to one business.
 *
 * Everything is read from Postgres. The scraper service owns writing — it runs
 * the scrapes and stores the results — so this app never touches the filesystem
 * and has no path coupling to the scraper repository. It also means the hosted
 * copy and the local copy read exactly the same data by exactly the same code.
 *
 * Business definitions live in the scraper's own files, but the service mirrors
 * them into Postgres whenever they change, so they are read from here too.
 */

export type DataSource = "database" | "none";

export function dataSource(): DataSource {
  return isDbConfigured() ? "database" : "none";
}

export async function getBusinesses(): Promise<Business[]> {
  if (!isDbConfigured()) return [];
  try {
    return await remote.readBusinesses();
  } catch {
    return [];
  }
}

/** Resolves a requested slug to a real business, falling back to the first. */
export async function resolveBusiness(slug?: string): Promise<Business | null> {
  const all = await getBusinesses();
  if (all.length === 0) return null;
  return all.find((b) => b.slug === slug) ?? all[0];
}

export interface DashboardData {
  source: DataSource;
  business: Business;
  runs: Run[];
  latestRun: Run | null;
  rows: TallyRow[];
  series: Series[];
  daily: { day: string; instagram: number; facebook: number; total: number }[];
  /** Sums across hashtags — NOT unique posts, since a post can carry several. */
  tallied: { tallied: number; instagram: number; facebook: number };
  /** True distinct post count. The honest headline number. */
  distinctPosts: number;
  configuredOnly: { platform: Platform; hashtag: string }[];
  ranToday: boolean;
  flags: Record<string, "aborted" | "budget_stopped">;
}

export async function getDashboard(business: Business): Promise<DashboardData> {
  const source = dataSource();
  const today = campaignDay();

  const [rows, runs, distinctPosts] =
    source === "database"
      ? await Promise.all([
          remote.readTallies(business.slug),
          remote.readRuns(business.slug),
          remote.countDistinctPosts(business.slug),
        ])
      : [[] as TallyRow[], [] as Run[], 0];

  const series = buildSeries(rows, today);
  const seen = new Set(series.map((s) => `${s.platform}:${s.hashtag}`));

  const flags: Record<string, "aborted" | "budget_stopped"> = {};
  for (const run of runs) {
    if (run.status === "aborted") flags[run.day] = "aborted";
    else if (run.status === "budget_stopped" && !flags[run.day]) flags[run.day] = "budget_stopped";
  }

  return {
    source,
    business,
    runs,
    latestRun: runs[0] ?? null,
    rows,
    series,
    daily: dailyNewPosts(rows, today),
    tallied: talliedTotals(series),
    distinctPosts,
    configuredOnly: business.hashtags.filter((h) => !seen.has(`${h.platform}:${h.hashtag}`)),
    ranToday: runs.some((r) => r.day === today),
    flags,
  };
}

export interface RunDetail {
  run: Run;
  rows: TallyRow[];
  neverVisited: { platform: Platform; hashtag: string }[];
  totals: { newPosts: number };
}

export async function getRun(business: Business, runId: string): Promise<RunDetail | null> {
  if (dataSource() === "none") return null;

  const [runs, allRows] = await Promise.all([
    remote.readRuns(business.slug),
    remote.readTallies(business.slug),
  ]);

  const run = runs.find((r) => r.id === runId);
  if (!run) return null;

  const rows = allRows.filter((r) => r.runId === runId);
  const visited = new Set(rows.map((r) => `${r.platform}:${r.hashtag}`));

  return {
    run,
    rows,
    neverVisited: business.hashtags.filter((h) => !visited.has(`${h.platform}:${h.hashtag}`)),
    totals: { newPosts: rows.reduce((sum, r) => sum + r.newPosts, 0) },
  };
}

export async function getPosts(
  businessSlug: string,
  platform: Platform,
  hashtag: string,
  limit = 60,
): Promise<Post[]> {
  if (dataSource() === "none") return [];
  return remote.readPosts(businessSlug, platform, hashtag, limit);
}

export async function getAllPosts(businessSlug: string): Promise<Post[]> {
  if (dataSource() === "none") return [];
  return remote.readAllPosts(businessSlug);
}
