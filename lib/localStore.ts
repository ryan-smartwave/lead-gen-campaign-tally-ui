import fs from "node:fs";
import path from "node:path";
import { campaignDay } from "./format";
import type {
  Business,
  Platform,
  Post,
  Run,
  RunStatus,
  TallyRow,
  TallyStatus,
  Target,
} from "./types";

/**
 * Reads the scraper's own files directly, per business.
 *
 * These files are the authoritative record: `seen.json` is what the scraper
 * deduplicates against. Each business has its own definition file and its own
 * data directory, so their dedup memories and run locks never interact.
 *
 * Deliberately plain `fs`: instantiating the scraper's TallyStore to read would
 * create directories and write a CSV header as a side effect.
 *
 *   scraper/config.json            global mcpEndpoint + safety
 *   scraper/businesses/<slug>.json { name, hashtags }
 *   scraper/data/<slug>/           tally.csv, seen.json, posts/
 */

const HASHTAG_RE = /^[A-Za-z0-9_.]+$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}$/;

export function scraperDir(): string {
  return process.env.SCRAPER_DIR
    ? path.resolve(process.cwd(), process.env.SCRAPER_DIR)
    : path.resolve(process.cwd(), "..", "scraper");
}

function businessesDir(): string {
  return path.join(scraperDir(), "businesses");
}

function dataDir(slug: string): string {
  return path.join(scraperDir(), "data", slug);
}

export function localStoreAvailable(): boolean {
  return fs.existsSync(businessesDir()) || fs.existsSync(path.join(scraperDir(), "config.json"));
}

/* ---------------- businesses ---------------- */

export function listBusinesses(): Business[] {
  let files: string[];
  try {
    files = fs.readdirSync(businessesDir()).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: Business[] = [];
  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(businessesDir(), file), "utf8"));
      out.push({
        slug,
        name: raw.name ?? slug,
        createdAt: raw.createdAt ?? null,
        hashtags: (raw.hashtags ?? []).map((h: { platform: Platform; value: string }) => ({
          platform: h.platform,
          hashtag: h.value,
        })),
      });
    } catch {
      /* a malformed file is skipped rather than breaking every read */
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function readBusiness(slug: string): Business | null {
  return listBusinesses().find((b) => b.slug === slug) ?? null;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Validation mirrors the scraper's: anything that could corrupt tally.csv is refused. */
export function validateHashtags(hashtags: Target[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  hashtags.forEach((h, i) => {
    if (h.platform !== "instagram" && h.platform !== "facebook") {
      problems.push(`Row ${i + 1}: platform must be Instagram or Facebook.`);
    }
    if (!HASHTAG_RE.test(h.hashtag ?? "")) {
      problems.push(
        `Row ${i + 1}: "${h.hashtag}" is not a usable hashtag — letters, digits, underscore and period only, and no leading #.`,
      );
    }
    const key = `${h.platform}:${h.hashtag}`;
    if (seen.has(key)) problems.push(`Row ${i + 1}: ${h.hashtag} is listed twice for ${h.platform}.`);
    seen.add(key);
  });
  return problems;
}

export function writeBusiness(input: {
  slug: string;
  name: string;
  hashtags: Target[];
}): Business {
  if (!SLUG_RE.test(input.slug)) {
    throw new Error(
      `"${input.slug}" is not a usable id — use lowercase letters, digits and hyphens.`,
    );
  }
  if (!input.name.trim()) throw new Error("A business needs a name.");
  const problems = validateHashtags(input.hashtags);
  if (problems.length) throw new Error(problems.join(" "));

  fs.mkdirSync(businessesDir(), { recursive: true });
  fs.mkdirSync(dataDir(input.slug), { recursive: true });

  const existing = readBusiness(input.slug);
  const payload = {
    name: input.name.trim(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    hashtags: input.hashtags.map((h) => ({ platform: h.platform, value: h.hashtag })),
  };
  fs.writeFileSync(
    path.join(businessesDir(), `${input.slug}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  return { slug: input.slug, ...payload, hashtags: input.hashtags };
}

/**
 * Removes the business definition only. Its collected data is left on disk, so
 * removing a business by mistake loses no scraped history.
 */
export function deleteBusiness(slug: string): void {
  fs.rmSync(path.join(businessesDir(), `${slug}.json`), { force: true });
}

/* ---------------- collected data ---------------- */

export function readTallies(slug: string): TallyRow[] {
  let text: string;
  try {
    text = fs.readFileSync(path.join(dataDir(slug), "tally.csv"), "utf8");
  } catch {
    return [];
  }
  const rows: TallyRow[] = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const parts = line.split(",");
    if (parts.length < 7) continue;
    const [runAt, , platform, hashtag, newPosts, cumulative, status] = parts;
    if (platform !== "instagram" && platform !== "facebook") continue;
    rows.push({
      runId: runAt,
      // Recomputed in campaign-local terms rather than trusting the file's
      // UTC-derived column, which is wrong for runs before 08:00 Manila time.
      day: campaignDay(runAt),
      platform,
      hashtag,
      postsOnPage: null, // never recorded in the CSV
      newPosts: Number(newPosts) || 0,
      cumulativeUnique: Number(cumulative) || 0,
      status: (status as TallyStatus) ?? "ok",
    });
  }
  return rows;
}

export function readRuns(slug: string): Run[] {
  const rows = readTallies(slug);
  const business = readBusiness(slug);
  const byRun = new Map<string, TallyRow[]>();
  for (const r of rows) {
    const list = byRun.get(r.runId);
    if (list) list.push(r);
    else byRun.set(r.runId, [r]);
  }

  const runs: Run[] = [];
  for (const [runId, group] of byRun) {
    const aborted = group.some((r) => r.status === "aborted");
    runs.push({
      id: runId,
      business: slug,
      campaign: business?.name ?? slug,
      day: campaignDay(runId),
      startedAt: runId, // the run id IS its ISO start time
      finishedAt: null, // not recorded in files
      status: (aborted ? "aborted" : "complete") as RunStatus,
      abortReason: aborted ? "recorded in tally.csv" : null,
      // CSV row order is visit order, so it doubles as the target list.
      targets: group.map((r) => ({ platform: r.platform, hashtag: r.hashtag })),
    });
  }
  return runs.sort((a, b) => (a.id < b.id ? 1 : -1));
}

export function readPosts(
  slug: string,
  platform: Platform,
  hashtag: string,
  limit = 200,
): Post[] {
  const file = path.join(dataDir(slug), "posts", `${platform}-${hashtag}.jsonl`);
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const posts: Post[] = [];
  for (const line of text.trim().split(/\r?\n/)) {
    if (!line) continue;
    try {
      const raw = JSON.parse(line);
      const base = {
        id: raw.id,
        firstSeenAt: raw.firstSeenAt,
        firstSeenRunId: raw.firstSeenAt ?? null,
        hashtag,
      };
      if (raw.platform === "facebook") {
        posts.push({
          ...base,
          platform: "facebook",
          author: raw.author ?? null,
          text: raw.text ?? null,
        });
      } else {
        posts.push({
          ...base,
          platform: "instagram",
          url: raw.url,
          preview: raw.preview ?? null,
        });
      }
    } catch {
      /* skip a malformed line rather than failing the page */
    }
  }
  return posts.reverse().slice(0, limit);
}

/** Distinct post ids across every hashtag — the real "unique posts" number. */
export function countDistinctPosts(slug: string): number {
  const dir = path.join(dataDir(slug), "posts");
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return 0;
  }
  const ids = new Set<string>();
  for (const file of files) {
    for (const line of fs.readFileSync(path.join(dir, file), "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        ids.add(JSON.parse(line).id);
      } catch {
        /* skip */
      }
    }
  }
  return ids.size;
}
