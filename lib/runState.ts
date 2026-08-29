/**
 * Pure reduction of run events into what the progress panel renders.
 *
 * Shared deliberately by two callers: the live event tail, and the snapshot
 * fetched after a page reload. Because every event carries `seq`, replaying a
 * snapshot and then continuing live cannot double-count — which is the whole
 * resumability story, and it lives here rather than in a component.
 */

import type { RunEvent, RunViewState, Target, TargetProgress } from "./types";
import { targetKey } from "./types";

export function initialRunState(): RunViewState {
  return {
    runId: null,
    status: "running",
    budgetMinutes: 0,
    startedAt: null,
    finishedAt: null,
    lastEventAt: null,
    lastSeq: 0,
    targets: [],
    results: {},
    waitUntil: null,
    waitingNext: null,
    danger: null,
    abortReason: null,
  };
}

export function reduceRunEvent(state: RunViewState, event: RunEvent): RunViewState {
  // Idempotent: a replayed or out-of-order event is ignored.
  if (event.seq <= state.lastSeq) return state;

  const next: RunViewState = {
    ...state,
    lastSeq: event.seq,
    lastEventAt: event.at,
    results: { ...state.results },
  };

  switch (event.type) {
    case "run_started": {
      next.runId = event.runId;
      next.startedAt = event.at;
      next.budgetMinutes = event.budgetMinutes;
      next.targets = event.targets;
      next.status = "running";
      next.results = {};
      for (const t of event.targets) {
        next.results[targetKey(t)] = { state: "pending" };
      }
      break;
    }

    case "hashtag_started": {
      next.waitUntil = null;
      next.waitingNext = null;
      next.results[targetKey(event)] = { state: "active" };
      break;
    }

    case "hashtag_done": {
      next.results[targetKey(event)] = {
        state: event.status === "empty" ? "empty" : "done",
        postsOnPage: event.postsOnPage,
        newCount: event.newCount,
        freshCount: event.freshCount ?? event.newCount,
        cumulative: event.cumulative,
        durationSeconds: event.durationSeconds,
      };
      break;
    }

    case "hashtag_error": {
      next.results[targetKey(event)] = { state: "error", message: event.message };
      break;
    }

    case "waiting": {
      // Absolute deadline, so a backgrounded tab's countdown cannot drift.
      next.waitUntil = new Date(event.at).getTime() + event.seconds * 1000;
      next.waitingNext = event.next;
      break;
    }

    case "danger": {
      next.danger = {
        reason: event.reason,
        url: event.url,
        hashtag: event.hashtag,
        incidentDir: event.incidentDir ?? null,
      };
      next.waitUntil = null;
      next.waitingNext = null;
      break;
    }

    case "run_finished": {
      next.status = event.status;
      next.finishedAt = event.at;
      next.abortReason = event.abortReason ?? null;
      next.waitUntil = null;
      next.waitingNext = null;
      // Anything still queued when a run aborts was never visited — say so
      // rather than leaving it looking merely pending.
      if (event.status !== "complete") {
        for (const [key, progress] of Object.entries(next.results)) {
          if (progress.state === "pending" || progress.state === "active") {
            next.results[key] = { state: "never_visited" };
          }
        }
      }
      break;
    }
  }

  return next;
}

export function reduceRunEvents(events: RunEvent[], from = initialRunState()): RunViewState {
  return events.reduce(reduceRunEvent, from);
}

/* ---------- derived helpers the panel needs ---------- */

export function progressCounts(state: RunViewState): {
  done: number;
  total: number;
  remaining: number;
} {
  const values = Object.values(state.results);
  const done = values.filter((r: TargetProgress) =>
    ["done", "empty", "error"].includes(r.state),
  ).length;
  const total = state.targets.length || values.length;
  return { done, total, remaining: Math.max(0, total - done) };
}

/**
 * What the run is doing RIGHT NOW, for the summary line and the stop button:
 * the hashtag being scrolled, the gap (with what's next), the enrichment
 * tail once every target is finished, or nothing when the run is over.
 */
export function currentActivity(
  state: RunViewState,
): { kind: "scrolling" | "waiting" | "finishing"; target: Target | null } | null {
  if (state.status !== "running") return null;
  for (const target of state.targets) {
    if (state.results[targetKey(target)]?.state === "active") {
      return { kind: "scrolling", target };
    }
  }
  if (state.waitingNext) return { kind: "waiting", target: state.waitingNext };
  const { remaining } = progressCounts(state);
  if (remaining === 0 && state.targets.length > 0) return { kind: "finishing", target: null };
  return null;
}

/**
 * An honest range, not a fake ETA: gaps between hashtags are randomised by
 * design, so the estimate is a span. Mirrors the scraper's configured gap.
 */
export function remainingEstimate(
  state: RunViewState,
  gapMinutes: [number, number] = [3, 7],
  workMinutes = 1,
): { minMinutes: number; maxMinutes: number } | null {
  const { remaining } = progressCounts(state);
  if (state.status !== "running" || remaining === 0) return null;
  return {
    minMinutes: Math.round(remaining * (gapMinutes[0] + workMinutes)),
    maxMinutes: Math.round(remaining * (gapMinutes[1] + workMinutes)),
  };
}
