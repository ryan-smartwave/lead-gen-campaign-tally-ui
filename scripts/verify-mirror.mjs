#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Schema-level checks for the write paths, against the real database, using a
 * throwaway business inside a transaction that is rolled back.
 *
 * Covers what lib/dbRunStore.ts writes during a run and what lib/sync.ts writes
 * when importing CLI-produced files — in particular that the importer's nulls
 * cannot erase values a live run observed. Here because those paths are
 * otherwise only exercised by a real 30–60 minute scrape; this catches wrong
 * column names and mismatched ON CONFLICT targets without touching Instagram or
 * Facebook.
 *
 * See also verify-db-store.mjs, which proves the deduplication arithmetic.
 */

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BIZ = "__mirror_verify__";
const RUN = "2000-01-01T00:00:00.000Z";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const check = (label, ok, detail = "") =>
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);

let failures = 0;
try {
  await client.query("begin");

  await client.query(
    `insert into businesses (slug, name, hashtags) values ($1,$2,'[]'::jsonb)
     on conflict (slug) do nothing`,
    [BIZ, "Mirror verification"],
  );

  // mirrorRunStarted
  await client.query(
    `insert into runs (id, business, campaign, started_at, campaign_day, status,
                       budget_minutes, targets, source, imported)
     values ($1,$2,$3,$4,$5,'running',$6,$7::jsonb,'web',false)
     on conflict (id) do update set status='running', business=excluded.business,
                                    targets=excluded.targets`,
    [RUN, BIZ, "Mirror verification", RUN, "2000-01-01", 60,
     JSON.stringify([{ platform: "instagram", hashtag: "verifytag" }])],
  );
  const running = await client.query("select status from runs where id=$1", [RUN]);
  check("run row inserted as running", running.rows[0]?.status === "running");

  // mirrorHashtagDone — tally
  await client.query(
    `insert into tallies (business, run_id, platform, hashtag, campaign_day, visit_seq,
                          posts_on_page, new_posts, cumulative_unique, status)
     values ($1,$2,'instagram','verifytag',$3,1,9,4,4,'ok')
     on conflict (business, run_id, platform, hashtag) do update set
       posts_on_page=excluded.posts_on_page, new_posts=excluded.new_posts,
       cumulative_unique=excluded.cumulative_unique, status=excluded.status,
       visit_seq=excluded.visit_seq`,
    [BIZ, RUN, "2000-01-01"],
  );
  // Repeat to prove the upsert path, not just the insert path.
  await client.query(
    `insert into tallies (business, run_id, platform, hashtag, campaign_day, visit_seq,
                          posts_on_page, new_posts, cumulative_unique, status)
     values ($1,$2,'instagram','verifytag',$3,1,11,5,5,'ok')
     on conflict (business, run_id, platform, hashtag) do update set
       posts_on_page=excluded.posts_on_page, new_posts=excluded.new_posts,
       cumulative_unique=excluded.cumulative_unique, status=excluded.status,
       visit_seq=excluded.visit_seq`,
    [BIZ, RUN, "2000-01-01"],
  );
  const tally = await client.query(
    "select posts_on_page, new_posts from tallies where business=$1 and run_id=$2",
    [BIZ, RUN],
  );
  check("tally upserts to one row", tally.rowCount === 1, `${tally.rowCount} row(s)`);
  check("posts_on_page persisted (the column the CSV never had)", tally.rows[0]?.posts_on_page === 11);

  // mirrorHashtagDone — posts, including the cross-hashtag overlap case
  for (const [hashtag, id] of [
    ["verifytag", "ig:p/AAA"],
    ["verifytag", "ig:p/BBB"],
    ["othertag", "ig:p/AAA"], // same post under a second hashtag: must be kept
  ]) {
    // first_run_id (text) and first_seen_at (timestamptz) need distinct
    // placeholders even though they carry the same value.
    await client.query(
      `insert into posts (business, platform, hashtag, post_id, first_run_id, first_seen_at,
                          url, preview, author, body)
       values ($1,'instagram',$2,$3,$4,$5,$6,$7,null,null)
       on conflict (business, platform, hashtag, post_id) do nothing`,
      [BIZ, hashtag, id, RUN, RUN, `https://instagram.com/p/${id}`, "caption, with a comma"],
    );
  }
  const posts = await client.query(
    "select count(*)::int n, count(distinct post_id)::int d from posts where business=$1",
    [BIZ],
  );
  check(
    "a post under two hashtags is stored twice, one distinct id",
    posts.rows[0].n === 3 && posts.rows[0].d === 2,
    `${posts.rows[0].n} rows / ${posts.rows[0].d} distinct`,
  );

  // mirrorHashtagFailed
  await client.query(
    `insert into tallies (business, run_id, platform, hashtag, campaign_day,
                          posts_on_page, new_posts, cumulative_unique, status, message)
     values ($1,$2,'facebook','failtag',$3,null,0,0,'aborted','login_wall')
     on conflict (business, run_id, platform, hashtag) do update set
       status=excluded.status, message=excluded.message`,
    [BIZ, RUN, "2000-01-01"],
  );
  const failed = await client.query(
    "select status, message, posts_on_page from tallies where business=$1 and hashtag='failtag'",
    [BIZ],
  );
  check(
    "an aborted hashtag records its reason with a null count",
    failed.rows[0]?.status === "aborted" &&
      failed.rows[0]?.message === "login_wall" &&
      failed.rows[0]?.posts_on_page === null,
  );

  // The end-of-run reconcile must not erase what the live run observed. It
  // reads the CSV, which has no posts-on-page column and cannot tell a stopped
  // run from a completed one, so it arrives with nulls and a guess.
  await client.query(
    `insert into tallies (business, run_id, platform, hashtag, campaign_day,
                          posts_on_page, new_posts, cumulative_unique, status)
     values ($1,$2,'instagram','verifytag',$3,null,5,5,'ok')
     on conflict (business, run_id, platform, hashtag) do update set
       posts_on_page = coalesce(excluded.posts_on_page, tallies.posts_on_page),
       new_posts = excluded.new_posts,
       cumulative_unique = excluded.cumulative_unique,
       status = excluded.status`,
    [BIZ, RUN, "2000-01-01"],
  );
  const afterSync = await client.query(
    "select posts_on_page from tallies where business=$1 and hashtag='verifytag'",
    [BIZ],
  );
  check(
    "a reconcile with null posts_on_page keeps the observed value",
    afterSync.rows[0]?.posts_on_page === 11,
    `got ${afterSync.rows[0]?.posts_on_page}`,
  );

  await client.query("update runs set status='stopped', source='web' where id=$1", [RUN]);
  await client.query(
    `insert into runs (id, business, campaign, started_at, campaign_day, status, targets, source, imported)
     values ($1,$2,$3,$4,$5,'complete','[]'::jsonb,'import',true)
     on conflict (id) do update set
       status = case when runs.source = 'web' then runs.status else excluded.status end,
       source = runs.source`,
    [RUN, BIZ, "Mirror verification", RUN, "2000-01-01"],
  );
  const afterRunSync = await client.query("select status, source from runs where id=$1", [RUN]);
  check(
    "a reconcile does not downgrade a live run's status",
    afterRunSync.rows[0]?.status === "stopped" && afterRunSync.rows[0]?.source === "web",
    `got ${afterRunSync.rows[0]?.status}/${afterRunSync.rows[0]?.source}`,
  );

  // mirrorHeartbeat + mirrorRunFinished
  await client.query("update runs set heartbeat_at = now() where id=$1", [RUN]);
  await client.query(
    "update runs set status=$2, abort_reason=$3, finished_at=now() where id=$1",
    [RUN, "aborted", "login_wall"],
  );
  const done = await client.query(
    "select status, abort_reason, finished_at from runs where id=$1",
    [RUN],
  );
  check(
    "run closes out with status and reason",
    done.rows[0]?.status === "aborted" && done.rows[0]?.abort_reason === "login_wall" &&
      done.rows[0]?.finished_at !== null,
  );

  failures = 0;
} catch (err) {
  failures = 1;
  console.error(`  FAIL threw: ${err.message}`);
} finally {
  // Everything happened in a transaction; roll it back so the real data is
  // untouched by this check.
  await client.query("rollback").catch(() => {});
  await client.end();
}

console.log(failures ? "\nmirror verification FAILED" : "\nmirror verification passed (rolled back)");
process.exit(failures ? 1 : 0);
