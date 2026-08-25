"use client";

import { useEffect, useState } from "react";
import type { RunViewState } from "@/lib/types";
import { duration, relativeTime } from "@/lib/format";
import { progressCounts, remainingEstimate } from "@/lib/runState";
import { dangerCopy, DANGER_REMEDY } from "@/lib/dangerCopy";
import { StatusPill } from "@/components/data/StatusPill";
import { HashtagChecklist } from "./HashtagChecklist";
import { GapCountdown } from "./GapCountdown";

export function RunProgress({
  state,
  connected,
  onStop,
}: {
  state: RunViewState;
  connected: boolean;
  onStop?: () => void;
}) {
  const [, tick] = useState(0);
  const running = state.status === "running";

  // Keeps elapsed time and "last update" moving, which is what proves to the
  // viewer that the page is alive during a deliberate silence.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [running]);

  const { done, total } = progressCounts(state);
  const estimate = remainingEstimate(state);
  const silentMinutes = state.lastEventAt
    ? (Date.now() - new Date(state.lastEventAt).getTime()) / 60_000
    : 0;

  return (
    <section className="card" aria-live="polite">
      <div className="row justify-between">
        <span className="card-title flex items-center gap-2">
          {running ? <span className="live-dot" aria-hidden="true" /> : null}
          {running ? "Scrape in progress" : "Last scrape"}
        </span>
        <StatusPill status={state.status} />
      </div>

      <div className="row gap-4 text-[13px]">
        <span className="num font-semibold">
          {done} of {total} hashtags
        </span>
        {state.startedAt ? (
          <span className="muted num">running {duration(state.startedAt, state.finishedAt)}</span>
        ) : null}
        {estimate ? (
          <span className="muted num">
            about {estimate.minMinutes}–{estimate.maxMinutes} min left
          </span>
        ) : null}
      </div>

      {/* Determinate budget bar: honest progress even during a silent gap. */}
      {running && state.budgetMinutes > 0 && state.startedAt ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-accent),#0c8ea4)] transition-[width] duration-1000"
            style={{
              width: `${Math.min(100, ((Date.now() - new Date(state.startedAt).getTime()) / (state.budgetMinutes * 60_000)) * 100)}%`,
            }}
          />
        </div>
      ) : null}

      {state.danger ? (
        <div
          role="alert"
          className="stack gap-1.5 rounded-[var(--radius-ctl)] border-l-[3px] border-danger bg-danger-bg p-3"
        >
          <strong className="text-danger">{dangerCopy(state.danger.reason).headline}</strong>
          <span className="text-[13px]">{dangerCopy(state.danger.reason).what}</span>
          {state.danger.hashtag ? (
            <span className="muted text-xs">
              Stopped while visiting #{state.danger.hashtag}
              {state.danger.url ? ` (${state.danger.url})` : ""}
            </span>
          ) : null}
          <span className="text-[13px] font-semibold">{DANGER_REMEDY}</span>
        </div>
      ) : null}

      {running && state.waitUntil ? (
        <GapCountdown waitUntil={state.waitUntil} next={state.waitingNext} />
      ) : null}

      <HashtagChecklist state={state} />

      <div className="row justify-between text-xs">
        <span className={silentMinutes > 8 ? "text-warn" : "muted"}>
          {state.lastEventAt ? `last update ${relativeTime(state.lastEventAt)}` : "no updates yet"}
          {silentMinutes > 12 ? " — longer than expected; check the terminal window" : ""}
        </span>
        {running ? (
          <span className="row gap-2">
            <span className="muted">{connected ? "live" : "reconnecting…"}</span>
            {onStop ? (
              <button type="button" className="btn btn-sm" onClick={onStop}>
                Stop after this hashtag
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </section>
  );
}
