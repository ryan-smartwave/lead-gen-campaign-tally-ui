/** Domain types, written from the scraper's real output shapes. */

export type Platform = "instagram" | "facebook";

/** Per-hashtag outcome within one run. */
export type TallyStatus = "ok" | "empty" | "error" | "aborted";

/**
 * Lifecycle of a whole run. `stopped` is a user-requested halt between
 * hashtags — distinct from `aborted`, which means a danger signal appeared.
 */
export type RunStatus =
  | "running"
  | "complete"
  | "aborted"
  | "budget_stopped"
  | "stopped";

export type Target = { platform: Platform; hashtag: string };

/** One tracked business. Several can be run from the same installation. */
export interface Business {
  slug: string;
  name: string;
  createdAt: string | null;
  hashtags: Target[];
  /**
   * Optional campaign window (YYYY-MM-DD). When set, a post counts as "fresh"
   * only if it was posted inside it; posts of unknown age still count. Null
   * means no window — every new post is fresh.
   */
  campaignStart: string | null;
  campaignEnd: string | null;
}

export interface Run {
  id: string;
  /** Which business this run belongs to. */
  business: string;
  campaign: string;
  /** Campaign day (Asia/Manila), YYYY-MM-DD. */
  day: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  abortReason: string | null;
  /** The shuffled, ordered targets this run intended to visit. */
  targets: Target[];
}

export interface TallyRow {
  runId: string;
  day: string;
  platform: Platform;
  hashtag: string;
  /**
   * Posts visible on the page this visit — distinguishes a stale hashtag from a
   * failed scrape. Null when unknowable: the scraper's CSV never recorded it, so
   * every row read from local files (and every imported historical row) is null.
   */
  postsOnPage: number | null;
  newPosts: number;
  /**
   * New posts that also fall inside the business's campaign window. Equals
   * newPosts when no window is configured. Older rows (before this column
   * existed) report 0.
   */
  freshPosts: number;
  cumulativeUnique: number;
  status: TallyStatus;
}

/**
 * Posts differ by platform and consumers must branch.
 * Instagram exposes a real permalink and a caption; Facebook redacts post URLs
 * through the automation layer, so those posts carry only author + text and are
 * identified by a content fingerprint.
 */
export interface InstagramPost {
  id: string;
  platform: "instagram";
  url: string;
  /** Image alt text, which in practice holds the caption. Often null. */
  preview: string | null;
  /** Rich fields captured from Instagram's own responses; null until enriched. */
  username: string | null;
  /** The real caption text (preferred over `preview` when present). */
  caption: string | null;
  imageUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
  /** When the post was published, ISO. Drives campaign-window freshness. */
  takenAt: string | null;
  /** When a post-page visit filled in missing fields, ISO; null if never. */
  enrichedAt: string | null;
  firstSeenAt: string;
  firstSeenRunId: string | null;
  hashtag: string;
  /** Other hashtags found in the post's own text, beyond the one searched. */
  otherHashtags: string[];
}

export interface FacebookPost {
  id: string;
  platform: "facebook";
  /** May be null, or the literal "<redacted>" when the automation layer hid it. */
  author: string | null;
  text: string | null;
  /**
   * Rich fields read passively from the page's own GraphQL responses or the
   * card's React props, or (url) derived from a DOM-harvested fbid. Null when
   * none of those passive sources covered the post.
   */
  url: string | null;
  username: string | null;
  /** The full message text, past the display's "See more" truncation. */
  caption: string | null;
  imageUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
  takenAt: string | null;
  firstSeenAt: string;
  firstSeenRunId: string | null;
  hashtag: string;
  /** Other hashtags found in the post's own text, beyond the one searched. */
  otherHashtags: string[];
}

export type Post = InstagramPost | FacebookPost;

/** One hashtag's cumulative curve over the campaign. */
export interface Series {
  platform: Platform;
  hashtag: string;
  points: { day: string; cumulative: number; newPosts: number }[];
}

/* ---------- preflight ---------- */

export type CheckId = "mcp" | "sessions" | "today" | "coverage";
export type CheckStatus = "pass" | "fail" | "warn" | "not_checked" | "stale";

/** Remedies the UI must spell out; `mcp_stale` needs a manual browser action. */
export type Remedy = "mcp_unreachable" | "mcp_stale" | "session_expired";

export interface Check {
  id: CheckId;
  status: CheckStatus;
  label: string;
  detail: string;
  remedy?: Remedy;
}

export interface Preflight {
  capability: "local" | "hosted";
  canRun: boolean;
  checks: Check[];
  activeRunId?: string;
  lastRun?: Pick<Run, "id" | "day" | "status" | "startedAt">;
}

/* ---------- run progress events ----------
   Every event carries seq + at so the reducer is idempotent: a client can
   replay a snapshot and then tail the live stream without double-counting. */

export type DangerReason =
  | "login_wall"
  | "checkpoint"
  | "try_again_later"
  | "activity_restricted"
  | "action_blocked"
  | "feed_refuse"
  | "account_disabled"
  | "not_logged_in";

interface EventBase {
  seq: number;
  at: string;
}

export type RunEvent =
  | (EventBase & {
      type: "run_started";
      runId: string;
      targets: Target[];
      budgetMinutes: number;
    })
  | (EventBase & { type: "hashtag_started"; platform: Platform; hashtag: string })
  | (EventBase & {
      type: "hashtag_done";
      platform: Platform;
      hashtag: string;
      postsOnPage: number;
      newCount: number;
      /** New posts also inside the campaign window; may be absent on old streams. */
      freshCount?: number;
      cumulative: number;
      status: "ok" | "empty";
    })
  | (EventBase & {
      type: "hashtag_error";
      platform: Platform;
      hashtag: string;
      message: string;
    })
  | (EventBase & {
      type: "waiting";
      seconds: number;
      next: Target | null;
    })
  | (EventBase & {
      type: "danger";
      reason: DangerReason;
      url: string | null;
      hashtag: string | null;
      /** Path to the forensic incident bundle on the scraper's machine. */
      incidentDir?: string | null;
    })
  | (EventBase & {
      type: "run_finished";
      status: Exclude<RunStatus, "running">;
      abortReason?: string;
    });

/** What a client renders: the reduction of every event seen so far. */
export interface RunViewState {
  runId: string | null;
  status: RunStatus;
  budgetMinutes: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastEventAt: string | null;
  lastSeq: number;
  targets: Target[];
  results: Record<string, TargetProgress>;
  /** Absolute epoch ms the current inter-hashtag gap ends, for a local countdown. */
  waitUntil: number | null;
  waitingNext: Target | null;
  danger: {
    reason: DangerReason;
    url: string | null;
    hashtag: string | null;
    incidentDir: string | null;
  } | null;
  abortReason: string | null;
}

export type TargetProgressState =
  | "pending"
  | "active"
  | "done"
  | "empty"
  | "error"
  | "never_visited";

export interface TargetProgress {
  state: TargetProgressState;
  postsOnPage?: number;
  newCount?: number;
  freshCount?: number;
  cumulative?: number;
  message?: string;
}

/** Stable key for a target across events, results maps, and DB rows. */
export function targetKey(t: Target): string {
  return `${t.platform}:${t.hashtag}`;
}
