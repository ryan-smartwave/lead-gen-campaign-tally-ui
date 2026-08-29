/**
 * Formatting, and the one place the campaign's day boundary is defined.
 *
 * The scraper's own CSV derives its date from an ISO string in UTC, which puts
 * any run before 08:00 local time on the previous day. The campaign is run from
 * Manila, so every day boundary in this app — the same-day guard, the daily
 * bars, run grouping — comes from here and nowhere else.
 */

export const CAMPAIGN_TZ = "Asia/Manila";

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAMPAIGN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Campaign day as YYYY-MM-DD in Asia/Manila. */
export function campaignDay(when: Date | string = new Date()): string {
  const d = typeof when === "string" ? new Date(when) : when;
  // en-CA with 2-digit parts yields YYYY-MM-DD directly.
  return DAY_FMT.format(d);
}

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPAIGN_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Clock time in campaign-local terms, e.g. "22:16". */
export function campaignTime(when: Date | string): string {
  const d = typeof when === "string" ? new Date(when) : when;
  return TIME_FMT.format(d);
}

const DATE_LABEL_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPAIGN_TZ,
  day: "numeric",
  month: "short",
});

/** "24 Aug", or "Today" / "Yesterday" when it reads better. */
export function dayLabel(day: string): string {
  const today = campaignDay();
  if (day === today) return "Today";
  const yesterday = campaignDay(new Date(Date.now() - 86_400_000));
  if (day === yesterday) return "Yesterday";
  // Parse as UTC noon so the label can't slip a day during formatting.
  return DATE_LABEL_FMT.format(new Date(`${day}T12:00:00Z`));
}

/** "22:16 today" style stamp for a run. */
export function runStamp(startedAt: string): string {
  return `${dayLabel(campaignDay(startedAt)).toLowerCase()} ${campaignTime(startedAt)}`;
}

/** Compact duration: "42m", "1h 07m", "38s". */
export function duration(fromIso: string, toIso: string | null): string {
  const end = toIso ? new Date(toIso).getTime() : Date.now();
  const ms = Math.max(0, end - new Date(fromIso).getTime());
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return `${Math.floor(ms / 1000)}s`;
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  return `${h}h ${String(totalMin % 60).padStart(2, "0")}m`;
}

/** "just now", "3m ago", "2h ago" — for proving the run panel is alive. */
export function relativeTime(iso: string, now = Date.now()): string {
  const secs = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** mm:ss for the inter-hashtag countdown. */
export function countdown(msRemaining: number): string {
  const s = Math.max(0, Math.ceil(msRemaining / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const NUM_FMT = new Intl.NumberFormat("en-US");

export function num(n: number): string {
  return NUM_FMT.format(n);
}

/** "+24" / "0" — a delta that reads as a delta. */
export function delta(n: number): string {
  return n > 0 ? `+${num(n)}` : num(n);
}

/** Compact duration from seconds: "48s", "14m", "1h 22m". */
export function fmtSeconds(seconds: number | null | undefined): string | null {
  if (seconds == null || Number.isNaN(seconds)) return null;
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
