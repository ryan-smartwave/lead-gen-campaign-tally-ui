import type { Business, Platform, Post, Run, Series, TallyRow } from "./types";
import * as local from "./localStore";
import * as remote from "./dbStore";
import { isDbConfigured } from "./db";
import { ledgerHasRun } from "./runLedger";
import { buildSeries, dailyNewPosts, talliedTotals } from "./series";
import { campaignDay } from "./format";

/**
 * The app's read API, scoped to one business. No screen knows which backend
 * answered.
 *
 * Truth is the scraper's own local files — `seen.json` is what it deduplicates
 * against — so when those files are present they win. The database is a
 * one-way mirror, and it is what the hosted copy reads on a phone.
 */

export type DataSource = "local" | "database" | "none";

/**
 * Where scrape RESULTS are read from.
 *
 * The database wins whenever one is configured, so what the screens show is
 * always what the database holds — clear it and the screens go empty, which is
 * the only behaviour that isn't confusing. Local files are the fallback for an
 * installation with no database at all.
 *
 * This is a display choice only and does not affect correctness of collection:
 * the scraper still deduplicates against its own `seen.json` regardless of what
 * the app reads, so results are never double-counted.
 */
export function dataSource(): DataSource {
  if (isDbConfigured()) return "database";
  if (local.localStoreAvailable()) return "local";
  return "none";
}

/**
 * Where CONFIGURATION is read from — deliberately not the same answer.
 *
 * Businesses and hashtags are what the scraper runs from and what Settings
 * edits, so the local files stay authoritative here. Reading them from the
 * database would mean clearing it left you with no businesses to select and
 * nothing to edit. The hosted copy, which has no files, falls back to the
 * mirrored snapshot.
 */
export async function getBusinesses(): Promise<Business[]> {
  if (local.localStoreAvailable()) {
    const fromFiles = local.listBusinesses();
    if (fromFiles.length > 0) return fromFiles;
  }
  if (isDbConfigured()) return remote.readBusinesses();
  return [];
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
  /**
   * Runs present in the scraper's local files but missing from the database.
   * Non-zero means the screens (which read the database) are behind what this
   * machine actually collected — usually after clearing the database, or after
   * a run that hasn't been synced yet. Null when there is nothing to compare.
   */
  unsyncedRuns: number | null;
}

export async function getDashboard(business: Business): Promise<DashboardData> {
  const source = dataSource();
  const today = campaignDay();

  let runs: Run[] = [];
  let rows: TallyRow[] = [];
  let distinctPosts = 0;

  if (source === "local") {
    rows = local.readTallies(business.slug);
    runs = local.readRuns(business.slug);
    distinctPosts = local.countDistinctPosts(business.slug);
  } else if (source === "database") {
    [rows, runs, distinctPosts] = await Promise.all([
      remote.readTallies(business.slug),
      remote.readRuns(business.slug),
      remote.countDistinctPosts(business.slug),
    ]);
  }

  // When reading from the database, check whether this machine holds runs the
  // database does not, so an unexpectedly empty screen can explain itself.
  let unsyncedRuns: number | null = null;
  if (source === "database" && local.localStoreAvailable()) {
    const localIds = new Set(local.readRuns(business.slug).map((r) => r.id));
    for (const run of runs) localIds.delete(run.id);
    unsyncedRuns = localIds.size;
  }

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
    unsyncedRuns,
  };
}

/**
 * Did this business already scrape today?
 *
 * Deliberately answered from the scraper's LOCAL files, never the database.
 * The files are the record of what actually ran; the database is a mirror that
 * can be cleared or fall behind. Sourcing this guard from the mirror would mean
 * emptying the database silently re-enabled a second run on the same day, which
 * is exactly the escalation ANTIBAN.md exists to prevent.
 */
export async function ranTodayForReal(business: Business): Promise<boolean> {
  const today = campaignDay();

  // The local ledger first: it is a one-line-per-run record that survives the
  // database being cleared, which is what stops a wipe from silently re-opening
  // a second run on the same day.
  if (ledgerHasRun(business.slug, today)) return true;

  // Then whichever record of actual runs exists. Any positive answer wins — a
  // guard should be conservative, so sources are OR-ed rather than ranked.
  if (local.localStoreAvailable() && local.readRuns(business.slug).some((r) => r.day === today)) {
    return true;
  }
  if (isDbConfigured()) {
    return (await remote.readRuns(business.slug)).some((r) => r.day === today);
  }
  return false;
}

export interface RunDetail {
  run: Run;
  rows: TallyRow[];
  neverVisited: { platform: Platform; hashtag: string }[];
  totals: { newPosts: number };
}

export async function getRun(business: Business, runId: string): Promise<RunDetail | null> {
  const source = dataSource();
  if (source === "none") return null;

  const [runs, allRows] =
    source === "local"
      ? [local.readRuns(business.slug), local.readTallies(business.slug)]
      : await Promise.all([
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
  const source = dataSource();
  if (source === "local") return local.readPosts(businessSlug, platform, hashtag, limit);
  if (source === "database") return remote.readPosts(businessSlug, platform, hashtag, limit);
  return [];
}
