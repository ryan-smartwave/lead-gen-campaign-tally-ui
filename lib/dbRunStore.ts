import { requireDb } from "./db";
import { campaignDay } from "./format";
import type { Platform } from "./types";

/**
 * A run store backed entirely by Postgres. Writes nothing to disk.
 *
 * This is what the web app hands to the scraper, so a web-driven run reads and
 * writes only the database — the scraper is used as a library and keeps no local
 * copies of anything.
 *
 * Deduplication comes from the same place the results do, which is the point:
 * `newCount` is however many post rows the insert actually created, and
 * `cumulative` is the row count for that hashtag afterwards. Both derive from
 * the `posts` table rather than from a local file that could drift out of step.
 *
 * The grain is (business, platform, hashtag, post_id). A post carrying several
 * campaign hashtags is counted under each, matching how the file-backed store
 * has always behaved, and two businesses tracking the same hashtag stay
 * independent.
 */

interface ScrapedPost {
  platform: Platform;
  id: string;
  url?: string;
  preview?: string | null;
  author?: string | null;
  text?: string | null;
}

interface RowInput {
  newCount: number;
  cumulative: number;
  status: "ok" | "empty" | "error" | "aborted";
  postsOnPage: number | null;
  visitSeq?: number;
  message?: string;
}

export interface RunStore {
  kind: string;
  record(
    h: { platform: Platform; value: string },
    posts: ScrapedPost[],
    runAt: string,
  ): Promise<{ newCount: number; cumulative: number }>;
  writeRow(
    h: { platform: Platform; value: string },
    runAt: string,
    row: RowInput,
  ): Promise<void>;
  seenCount(h: { platform: Platform; value: string }): Promise<number>;
  finish(): Promise<void>;
}

export function createDbRunStore(input: {
  business: string;
  campaign: string;
  runId: string;
  budgetMinutes: number;
  targets: { platform: Platform; hashtag: string }[];
}): RunStore {
  const sql = requireDb();
  const day = campaignDay(input.runId);

  /** Opens the run row. Awaited before the first hashtag, so the FK exists. */
  const ready = (async () => {
    // The lockfile guarantees no other run is live, so any row still marked
    // running belongs to a crashed process and can be closed out.
    await sql`
      update runs set status = 'aborted', abort_reason = 'process ended without finishing',
                      finished_at = now()
      where status = 'running'
    `;
    await sql`
      insert into runs (id, business, campaign, started_at, campaign_day, status,
                        budget_minutes, targets, source, imported)
      values (${input.runId}, ${input.business}, ${input.campaign}, ${input.runId},
              ${day}, 'running', ${input.budgetMinutes},
              ${JSON.stringify(input.targets)}::jsonb, 'web', false)
      on conflict (id) do update set
        status = 'running', business = excluded.business, targets = excluded.targets
    `;
  })();

  return {
    kind: "database",

    async record(h, posts) {
      await ready;
      let newCount = 0;

      for (const post of posts) {
        // A no-op insert returns no rows, so the returned row count IS the
        // number of genuinely new posts — dedup and persistence in one step.
        const inserted = (await sql`
          insert into posts (business, platform, hashtag, post_id, first_run_id, first_seen_at,
                             url, preview, author, body)
          values (${input.business}, ${h.platform}, ${h.value}, ${post.id},
                  ${input.runId}, ${input.runId},
                  ${post.url ?? null}, ${post.preview ?? null},
                  ${post.author ?? null}, ${post.text ?? null})
          on conflict (business, platform, hashtag, post_id) do nothing
          returning post_id
        `) as unknown[];
        if (inserted.length > 0) newCount += 1;
      }

      const counted = (await sql`
        select count(*) as n from posts
        where business = ${input.business} and platform = ${h.platform} and hashtag = ${h.value}
      `) as { n: string | number }[];

      return { newCount, cumulative: Number(counted[0]?.n ?? 0) };
    },

    async writeRow(h, _runAt, row) {
      await ready;
      // Always the run id this store was opened with: it is the row the posts
      // and the foreign key point at.
      await sql`
        insert into tallies (business, run_id, platform, hashtag, campaign_day, visit_seq,
                             posts_on_page, new_posts, cumulative_unique, status, message)
        values (${input.business}, ${input.runId}, ${h.platform}, ${h.value}, ${day},
                ${row.visitSeq ?? null}, ${row.postsOnPage}, ${row.newCount},
                ${row.cumulative}, ${row.status}, ${row.message ?? null})
        on conflict (business, run_id, platform, hashtag) do update set
          posts_on_page = excluded.posts_on_page,
          new_posts = excluded.new_posts,
          cumulative_unique = excluded.cumulative_unique,
          status = excluded.status,
          visit_seq = excluded.visit_seq,
          message = excluded.message
      `;
    },

    async seenCount(h) {
      await ready;
      const counted = (await sql`
        select count(*) as n from posts
        where business = ${input.business} and platform = ${h.platform} and hashtag = ${h.value}
      `) as { n: string | number }[];
      return Number(counted[0]?.n ?? 0);
    },

    async finish() {
      await ready;
    },
  };
}

/** Closes out the run row once the loop has ended. */
export async function closeRun(
  runId: string,
  status: string,
  abortReason: string | null,
): Promise<void> {
  const sql = requireDb();
  await sql`
    update runs
    set status = ${status}, abort_reason = ${abortReason}, finished_at = now()
    where id = ${runId}
  `;
}

/** Keeps the run row's heartbeat fresh through the long silent gaps. */
export async function heartbeat(runId: string): Promise<void> {
  const sql = requireDb();
  await sql`update runs set heartbeat_at = now() where id = ${runId}`;
}

/**
 * Records that a business ran on a given day, in a small local ledger.
 *
 * This is the one thing that stays on disk for a database-backed run, and it is
 * not scraped data — it is the memory behind the once-a-day guard. Without it,
 * clearing the database would make the app forget it had run today and silently
 * re-open a second run, which is the escalation ANTIBAN.md exists to prevent.
 */
export interface RunLedgerEntry {
  day: string;
  runId: string;
  status: string;
}
