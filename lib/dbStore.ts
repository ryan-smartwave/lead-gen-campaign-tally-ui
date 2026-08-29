import { requireDb } from "./db";
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
 * Database reads, for instances with no local scraper files — i.e. the hosted
 * copy people open on a phone. Every query is scoped to one business.
 *
 * Dates are always cast to text in SQL. A Postgres `date` comes back as a JS
 * Date in UTC, which would render 2026-08-24 (Manila) as the 23rd; casting
 * keeps the campaign day exactly as stored.
 */

export async function readBusinesses(): Promise<Business[]> {
  const sql = requireDb();
  const rows = (await sql`
    select slug, name, created_at, hashtags,
           campaign_start::text as campaign_start, campaign_end::text as campaign_end
    from businesses order by name
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    slug: r.slug as string,
    name: r.name as string,
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    hashtags: (r.hashtags as Target[]) ?? [],
    campaignStart: (r.campaign_start as string) ?? null,
    campaignEnd: (r.campaign_end as string) ?? null,
  }));
}

export async function readRuns(business: string): Promise<Run[]> {
  const sql = requireDb();
  const rows = (await sql`
    select id, business, campaign, started_at, campaign_day::text as day, finished_at,
           status, abort_reason, targets
    from runs
    where business = ${business}
    order by id desc
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id as string,
    business: r.business as string,
    campaign: r.campaign as string,
    day: r.day as string,
    startedAt: new Date(r.started_at as string).toISOString(),
    finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null,
    status: r.status as RunStatus,
    abortReason: (r.abort_reason as string) ?? null,
    targets: (r.targets as Target[]) ?? [],
  }));
}

export async function readTallies(business: string): Promise<TallyRow[]> {
  const sql = requireDb();
  const rows = (await sql`
    select run_id, campaign_day::text as day, platform, hashtag,
           posts_on_page, new_posts, fresh_posts, cumulative_unique, status
    from tallies
    where business = ${business}
    order by run_id asc
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    runId: r.run_id as string,
    day: r.day as string,
    platform: r.platform as Platform,
    hashtag: r.hashtag as string,
    postsOnPage: r.posts_on_page === null ? null : Number(r.posts_on_page),
    newPosts: Number(r.new_posts),
    // Column added later; a null from an older row means "unknown", not fresh.
    freshPosts: r.fresh_posts === null || r.fresh_posts === undefined ? 0 : Number(r.fresh_posts),
    cumulativeUnique: Number(r.cumulative_unique),
    status: r.status as TallyStatus,
  }));
}

// Both post-reading queries select the same columns and map them the same way.
// The mapper is shared here so a field can never be mapped in one path but not
// the other; the column lists are kept identical by eye in the two queries below.
function mapPostRow(r: Record<string, unknown>): Post {
  const base = {
    id: r.post_id as string,
    hashtag: r.hashtag as string,
    firstSeenAt: new Date(r.first_seen_at as string).toISOString(),
    firstSeenRunId: (r.first_run_id as string) ?? null,
  };
  const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const isoOrNull = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  const otherHashtags = Array.isArray(r.other_hashtags) ? (r.other_hashtags as string[]) : [];
  return r.platform === "facebook"
    ? {
        ...base,
        platform: "facebook" as const,
        author: (r.author as string) ?? null,
        text: (r.body as string) ?? null,
        url: (r.url as string) ?? null,
        username: (r.username as string) ?? null,
        caption: (r.caption as string) ?? null,
        imageUrl: (r.image_url as string) ?? null,
        likeCount: numOrNull(r.like_count),
        commentCount: numOrNull(r.comment_count),
        takenAt: isoOrNull(r.taken_at),
        otherHashtags,
      }
    : {
        ...base,
        platform: "instagram" as const,
        url: r.url as string,
        preview: (r.preview as string) ?? null,
        username: (r.username as string) ?? null,
        caption: (r.caption as string) ?? null,
        imageUrl: (r.image_url as string) ?? null,
        likeCount: numOrNull(r.like_count),
        commentCount: numOrNull(r.comment_count),
        takenAt: isoOrNull(r.taken_at),
        enrichedAt: isoOrNull(r.enriched_at),
        otherHashtags,
      };
}

export async function readPosts(
  business: string,
  platform: Platform,
  hashtag: string,
  limit = 60,
): Promise<Post[]> {
  const sql = requireDb();
  const rows = (await sql`
    select platform, hashtag, post_id, first_run_id, first_seen_at, url, preview, author, body,
           username, caption, image_url, like_count, comment_count, taken_at, enriched_at, other_hashtags
    from posts
    where business = ${business} and platform = ${platform} and hashtag = ${hashtag}
    order by first_seen_at desc, post_id desc
    limit ${limit}
  `) as Record<string, unknown>[];

  return rows.map(mapPostRow);
}

/** The honest headline: distinct posts, not the sum of per-hashtag counts. */
export async function countDistinctPosts(business: string): Promise<number> {
  const sql = requireDb();
  const rows = (await sql`
    select count(distinct post_id) as n from posts where business = ${business}
  `) as { n: string | number }[];
  return Number(rows[0]?.n ?? 0);
}

/** Every post for a business, for CSV export. */
export async function readAllPosts(business: string): Promise<Post[]> {
  const sql = requireDb();
  const rows = (await sql`
    select platform, hashtag, post_id, first_run_id, first_seen_at, url, preview, author, body,
           username, caption, image_url, like_count, comment_count, taken_at, enriched_at, other_hashtags
    from posts
    where business = ${business}
    order by hashtag, first_seen_at desc, post_id desc
  `) as Record<string, unknown>[];

  return rows.map(mapPostRow);
}
