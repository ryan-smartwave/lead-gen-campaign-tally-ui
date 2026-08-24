#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Proves the database-backed store's deduplication, which is what replaced
 * seen.json for web-driven runs.
 *
 * The load-bearing trick is `on conflict do nothing returning post_id`: an
 * insert that hits an existing row returns nothing, so the returned row count
 * IS the number of genuinely new posts. If that ever stopped holding, every run
 * would report everything as new.
 *
 * Runs in a transaction that is rolled back, so real data is untouched.
 */

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BIZ = "__store_verify__";
const RUN1 = "2000-01-01T00:00:00.000Z";
const RUN2 = "2000-01-02T00:00:00.000Z";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/** Mirrors createDbRunStore().record(): insert each post, count what landed. */
async function record(runId, hashtag, ids) {
  let newCount = 0;
  for (const id of ids) {
    const res = await client.query(
      `insert into posts (business, platform, hashtag, post_id, first_run_id, first_seen_at,
                          url, preview, author, body)
       values ($1,'instagram',$2,$3,$4,$5,null,null,null,null)
       on conflict (business, platform, hashtag, post_id) do nothing
       returning post_id`,
      [BIZ, hashtag, id, runId, runId],
    );
    if (res.rowCount > 0) newCount += 1;
  }
  const counted = await client.query(
    "select count(*)::int n from posts where business=$1 and platform='instagram' and hashtag=$2",
    [BIZ, hashtag],
  );
  return { newCount, cumulative: counted.rows[0].n };
}

try {
  await client.query("begin");
  await client.query(
    `insert into businesses (slug, name, hashtags) values ($1,$2,'[]'::jsonb)
     on conflict (slug) do nothing`,
    [BIZ, "Store verification"],
  );
  // Only one row may be 'running' at a time (enforced by runs_one_running), so
  // the earlier run is inserted already closed — as it would be in reality.
  for (const [id, status] of [
    [RUN1, "complete"],
    [RUN2, "running"],
  ]) {
    await client.query(
      `insert into runs (id, business, campaign, started_at, campaign_day, status, targets, source)
       values ($1,$2,'Store verification',$3,$4,$5,'[]'::jsonb,'web')
       on conflict (id) do nothing`,
      [id, BIZ, id, "2000-01-01", status],
    );
  }

  const first = await record(RUN1, "tagA", ["p1", "p2", "p3"]);
  check("a first visit counts every post as new", first.newCount === 3 && first.cumulative === 3,
    `${first.newCount} new / ${first.cumulative} total`);

  const second = await record(RUN2, "tagA", ["p2", "p3", "p4"]);
  check(
    "a later run counts only genuinely new posts",
    second.newCount === 1 && second.cumulative === 4,
    `${second.newCount} new / ${second.cumulative} total`,
  );

  const otherTag = await record(RUN2, "tagB", ["p1", "p9"]);
  check(
    "the same post under a different hashtag is new again",
    otherTag.newCount === 2 && otherTag.cumulative === 2,
    `${otherTag.newCount} new / ${otherTag.cumulative} total`,
  );

  const firstSeen = await client.query(
    "select first_run_id from posts where business=$1 and hashtag='tagA' and post_id='p2'",
    [BIZ],
  );
  check(
    "an existing post keeps its original first-seen run",
    firstSeen.rows[0].first_run_id === RUN1,
    firstSeen.rows[0].first_run_id,
  );

  const distinct = await client.query(
    "select count(*)::int rows, count(distinct post_id)::int d from posts where business=$1",
    [BIZ],
  );
  check(
    "tallied rows exceed distinct posts where hashtags overlap",
    distinct.rows[0].rows === 6 && distinct.rows[0].d === 5,
    `${distinct.rows[0].rows} rows / ${distinct.rows[0].d} distinct`,
  );
} catch (err) {
  failures += 1;
  console.error(`  FAIL threw: ${err.message}`);
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}

console.log(failures ? "\ndb store verification FAILED" : "\ndb store verification passed (rolled back)");
process.exit(failures ? 1 : 0);
