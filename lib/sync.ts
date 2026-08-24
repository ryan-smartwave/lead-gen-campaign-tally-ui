import { requireDb } from "./db";
import * as local from "./localStore";
import type { Platform } from "./types";

/**
 * Pushes the scraper's local files into Postgres, per business.
 *
 * Direction is strictly one-way, files -> database. The local files are what the
 * scraper deduplicates against, so they are the truth; the database is a mirror
 * that exists so results can be read from a phone. Because it is one-way there
 * is nothing to reconcile, and because every write is an upsert on a natural
 * key, running this twice changes nothing.
 */

export interface SyncResult {
  businesses: number;
  runs: number;
  tallies: number;
  posts: number;
  distinctPosts: number;
}

/** Business definitions only — cheap, and called after every edit. */
export async function syncBusinesses(): Promise<number> {
  const sql = requireDb();
  const businesses = local.listBusinesses();
  for (const b of businesses) {
    await sql`
      insert into businesses (slug, name, created_at, hashtags)
      values (${b.slug}, ${b.name}, ${b.createdAt ?? new Date().toISOString()},
              ${JSON.stringify(b.hashtags)}::jsonb)
      on conflict (slug) do update set
        name = excluded.name,
        hashtags = excluded.hashtags
    `;
  }
  return businesses.length;
}

export async function syncToDatabase(): Promise<SyncResult> {
  const sql = requireDb();
  const businesses = local.listBusinesses();
  await syncBusinesses();

  let runCount = 0;
  let tallyCount = 0;
  let postCount = 0;
  const distinct = new Set<string>();

  for (const business of businesses) {
    const runs = local.readRuns(business.slug);
    const rows = local.readTallies(business.slug);

    for (const run of runs) {
      await sql`
        insert into runs (id, business, campaign, started_at, campaign_day, status,
                          abort_reason, targets, source, imported)
        values (${run.id}, ${business.slug}, ${run.campaign}, ${run.startedAt}, ${run.day},
                ${run.status}, ${run.abortReason}, ${JSON.stringify(run.targets)}::jsonb,
                'import', true)
        on conflict (id) do update set
          business = excluded.business,
          campaign = excluded.campaign,
          campaign_day = excluded.campaign_day,
          targets = excluded.targets,
          -- Never downgrade a live run's own record. Status reconstructed from
          -- files is a guess: the CSV cannot distinguish "stopped" or
          -- "budget_stopped" from "complete", so a run this app actually
          -- watched keeps what it reported.
          status = case when runs.source = 'web' then runs.status else excluded.status end,
          abort_reason = case when runs.source = 'web' then runs.abort_reason
                              else excluded.abort_reason end,
          source = runs.source
      `;
      runCount += 1;
    }

    for (const row of rows) {
      await sql`
        insert into tallies (business, run_id, platform, hashtag, campaign_day,
                             posts_on_page, new_posts, cumulative_unique, status)
        values (${business.slug}, ${row.runId}, ${row.platform}, ${row.hashtag}, ${row.day},
                ${row.postsOnPage}, ${row.newPosts}, ${row.cumulativeUnique}, ${row.status})
        on conflict (business, run_id, platform, hashtag) do update set
          -- The CSV never recorded posts-on-page, so this arrives null. Keep
          -- whatever the live run observed rather than erasing it.
          posts_on_page = coalesce(excluded.posts_on_page, tallies.posts_on_page),
          new_posts = excluded.new_posts,
          cumulative_unique = excluded.cumulative_unique,
          status = excluded.status
      `;
      tallyCount += 1;
    }

    const pairs = new Map<string, { platform: Platform; hashtag: string }>();
    for (const row of rows) {
      pairs.set(`${row.platform}:${row.hashtag}`, {
        platform: row.platform,
        hashtag: row.hashtag,
      });
    }
    const runIds = new Set(runs.map((r) => r.id));

    for (const { platform, hashtag } of pairs.values()) {
      for (const post of local.readPosts(business.slug, platform, hashtag, 100_000)) {
        // first_run_id is a foreign key, so only attach posts to known runs.
        const runId = runIds.has(post.firstSeenAt) ? post.firstSeenAt : runs.at(-1)?.id;
        if (!runId) continue;
        distinct.add(`${business.slug}:${post.id}`);
        await sql`
          insert into posts (business, platform, hashtag, post_id, first_run_id, first_seen_at,
                             url, preview, author, body)
          values (${business.slug}, ${platform}, ${hashtag}, ${post.id}, ${runId},
                  ${post.firstSeenAt},
                  ${post.platform === "instagram" ? post.url : null},
                  ${post.platform === "instagram" ? post.preview : null},
                  ${post.platform === "facebook" ? post.author : null},
                  ${post.platform === "facebook" ? post.text : null})
          on conflict (business, platform, hashtag, post_id) do nothing
        `;
        postCount += 1;
      }
    }
  }

  return {
    businesses: businesses.length,
    runs: runCount,
    tallies: tallyCount,
    posts: postCount,
    distinctPosts: distinct.size,
  };
}
