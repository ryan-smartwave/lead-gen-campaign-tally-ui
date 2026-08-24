/**
 * Plain-English copy for the scraper's danger signals, in one place.
 *
 * These map the `reason` codes raised by the scraper's safety probe. The remedy
 * is nearly always the same and the reason it matters is worth repeating: blocks
 * escalate when you retry through them, so a missed day is the cheap outcome.
 */

import type { DangerReason } from "./types";

interface DangerCopy {
  headline: string;
  what: string;
}

const COPY: Record<DangerReason, DangerCopy> = {
  login_wall: {
    headline: "Signed out mid-run",
    what: "The platform redirected to its login page, which means that Chrome profile is no longer signed in.",
  },
  not_logged_in: {
    headline: "Not signed in",
    what: "The scraper reached the hashtag page but the session was already signed out.",
  },
  checkpoint: {
    headline: "Security checkpoint",
    what: "The platform interrupted with a challenge or checkpoint page — it wants to confirm a human is driving.",
  },
  try_again_later: {
    headline: "Asked to try again later",
    what: "The platform returned a soft rate-limit notice. It is throttling this account for now.",
  },
  activity_restricted: {
    headline: "Activity restricted",
    what: "The platform showed its “we restrict certain activity” notice, a direct signal that it flagged the behaviour.",
  },
  action_blocked: {
    headline: "Temporarily blocked",
    what: "The platform reported the account as temporarily blocked.",
  },
  feed_refuse: {
    headline: "Feed refused to load",
    what: "The platform declined to refresh the feed, which usually means soft throttling rather than a hard block.",
  },
  account_disabled: {
    headline: "Account disabled",
    what: "The platform reported the account as disabled. This is the serious one and needs a human look before anything else.",
  },
};

/** The remedy is shared: stop for the day, clear it by hand, resume tomorrow. */
export const DANGER_REMEDY =
  "Do not run again today. Open the app manually in that Chrome profile, clear whatever it is asking for like a normal visit, browse for a minute, and resume tomorrow. Blocks escalate when you retry through them.";

export function dangerCopy(reason: DangerReason): DangerCopy {
  return (
    COPY[reason] ?? {
      headline: "Run stopped on a danger signal",
      what: `The scraper aborted on an unrecognised signal (${reason}).`,
    }
  );
}

/**
 * The stale-session case is different: it is not a ban signal, and the fix is a
 * manual browser action this app cannot perform. Kept verbatim alongside the
 * scraper's own BUSY_HINT so the two never drift.
 */
export const MCP_STALE_STEPS = [
  "Open a new tab and paste chrome://extensions in the address bar. Browsers block pages from linking to chrome:// URLs, so this cannot be a link.",
  'Click the reload icon on "Chrome MCP Server".',
  "Open its popup and confirm it says Service Running · Port 12306.",
  "Come back here and re-check.",
];
