/**
 * Pure aggregation: tally rows in, chart-ready shapes out.
 *
 * The important rule here is forward-filling. Runs shuffle their targets and cap
 * how many they visit, so a hashtag legitimately has no row on some days. A
 * cumulative curve must hold its last value across those gaps — interpolating
 * invents data, and dropping to zero claims the campaign lost posts it still has.
 */

import type { Platform, Series, TallyRow } from "./types";
import { targetKey } from "./types";

/** Every campaign day from the first row to today, inclusive. */
export function dayRange(rows: TallyRow[], today: string): string[] {
  if (rows.length === 0) return [];
  const first = rows.reduce((min, r) => (r.day < min ? r.day : min), rows[0].day);
  const days: string[] = [];
  for (let t = Date.parse(`${first}T12:00:00Z`); ; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    days.push(day);
    if (day >= today) break;
    if (days.length > 800) break; // guard against a bad first date
  }
  return days;
}

/**
 * One forward-filled series per hashtag. `cumulative` holds across days with no
 * row; `newPosts` is 0 on those days, since nothing was discovered.
 */
export function buildSeries(rows: TallyRow[], today = ""): Series[] {
  if (rows.length === 0) return [];
  const days = dayRange(rows, today || rows.reduce((max, r) => (r.day > max ? r.day : max), rows[0].day));

  // Latest row per (hashtag, day) — a day could hold more than one run.
  const byTarget = new Map<string, { platform: Platform; hashtag: string; days: Map<string, TallyRow> }>();
  for (const r of rows) {
    const key = targetKey({ platform: r.platform, hashtag: r.hashtag });
    let entry = byTarget.get(key);
    if (!entry) {
      entry = { platform: r.platform, hashtag: r.hashtag, days: new Map() };
      byTarget.set(key, entry);
    }
    const existing = entry.days.get(r.day);
    // Keep the row with the highest cumulative for that day.
    if (!existing || r.cumulativeUnique >= existing.cumulativeUnique) entry.days.set(r.day, r);
  }

  const out: Series[] = [];
  for (const { platform, hashtag, days: dayRows } of byTarget.values()) {
    let carried = 0;
    let started = false;
    const points: Series["points"] = [];
    for (const day of days) {
      const row = dayRows.get(day);
      if (row) {
        started = true;
        carried = row.cumulativeUnique;
        points.push({ day, cumulative: carried, newPosts: row.newPosts });
      } else if (started) {
        points.push({ day, cumulative: carried, newPosts: 0 });
      }
      // Before a hashtag's first appearance it has no line at all.
    }
    out.push({ platform, hashtag, points });
  }

  // Biggest curve first, so the table and legend lead with what matters.
  return out.sort((a, b) => lastCumulative(b) - lastCumulative(a));
}

export function lastCumulative(s: Series): number {
  return s.points.length ? s.points[s.points.length - 1].cumulative : 0;
}

/** Newly discovered posts per day, split by platform, for the stacked bars. */
export function dailyNewPosts(
  rows: TallyRow[],
  today = "",
): { day: string; instagram: number; facebook: number; total: number }[] {
  if (rows.length === 0) return [];
  const days = dayRange(rows, today || rows.reduce((max, r) => (r.day > max ? r.day : max), rows[0].day));
  const acc = new Map<string, { instagram: number; facebook: number }>();
  for (const day of days) acc.set(day, { instagram: 0, facebook: 0 });
  for (const r of rows) {
    const entry = acc.get(r.day);
    if (!entry) continue;
    entry[r.platform] += r.newPosts;
  }
  return days.map((day) => {
    const e = acc.get(day)!;
    return { day, ...e, total: e.instagram + e.facebook };
  });
}

/**
 * Per-platform sums of each hashtag's latest cumulative count.
 *
 * IMPORTANT: these are sums ACROSS HASHTAGS, and a post can appear under several
 * hashtags — in the current data 174 tallied posts are only 159 distinct posts.
 * So this is "tallied posts", never "unique posts". A true distinct count can
 * only come from the store (a COUNT DISTINCT over post ids) and is passed in
 * separately by the caller.
 */
export function talliedTotals(series: Series[]): {
  tallied: number;
  instagram: number;
  facebook: number;
} {
  let tallied = 0;
  let instagram = 0;
  let facebook = 0;
  for (const s of series) {
    const c = lastCumulative(s);
    tallied += c;
    if (s.platform === "instagram") instagram += c;
    else facebook += c;
  }
  return { tallied, instagram, facebook };
}
