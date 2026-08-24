import type { Post, Run, TallyRow } from "./types";

/**
 * CSV generation with real quoting.
 *
 * Note this is stricter than the scraper's own tally.csv, which is written by
 * plain concatenation and stays safe only because hashtags are validated. These
 * exports carry captions — full of commas, quotes, emoji and newlines — so
 * every field is quoted properly per RFC 4180.
 */

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Quote if the value contains a delimiter, a quote, or any newline.
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  // A trailing newline, and a BOM so Excel opens UTF-8 captions correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function talliesCsv(rows: TallyRow[], runs: Run[]): string {
  const runById = new Map(runs.map((r) => [r.id, r]));
  return toCsv(
    [
      "campaign_day",
      "run_started_at",
      "run_status",
      "platform",
      "hashtag",
      "posts_on_page",
      "new_posts",
      "cumulative_unique",
      "status",
    ],
    rows.map((r) => [
      r.day,
      r.runId,
      runById.get(r.runId)?.status ?? "",
      r.platform,
      r.hashtag,
      r.postsOnPage,
      r.newPosts,
      r.cumulativeUnique,
      r.status,
    ]),
  );
}

export function postsCsv(posts: Post[]): string {
  return toCsv(
    ["platform", "hashtag", "post_id", "first_seen_at", "url", "author", "text"],
    posts.map((p) => [
      p.platform,
      p.hashtag,
      p.id,
      p.firstSeenAt,
      p.platform === "instagram" ? p.url : "",
      p.platform === "facebook" ? p.author : "",
      p.platform === "instagram" ? p.preview : p.text,
    ]),
  );
}

export function runsCsv(runs: Run[], rows: TallyRow[]): string {
  return toCsv(
    [
      "campaign_day",
      "run_id",
      "started_at",
      "status",
      "hashtags_visited",
      "new_posts",
      "abort_reason",
    ],
    runs.map((run) => {
      const mine = rows.filter((r) => r.runId === run.id);
      return [
        run.day,
        run.id,
        run.startedAt,
        run.status,
        mine.length,
        mine.reduce((sum, r) => sum + r.newPosts, 0),
        run.abortReason ?? "",
      ];
    }),
  );
}

/** A filename that sorts well and says what it is. */
export function exportFilename(business: string, kind: string, day: string): string {
  return `${business}-${kind}-${day}.csv`;
}
