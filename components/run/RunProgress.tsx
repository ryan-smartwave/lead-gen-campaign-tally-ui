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
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="card-title">
          {running ? "Scrape in progress" : "Last scrape"}
        </span>
        <StatusPill status={state.status} />
      </div>

      <div className="row" style={{ gap: "var(--space-4)", fontSize: 13 }}>
        <span className="num">
          {done} of {total} hashtags
        </span>
        {state.startedAt ? (
          <span className="muted num">
            running {duration(state.startedAt, state.finishedAt)}
          </span>
        ) : null}
        {estimate ? (
          <span className="muted num">
            about {estimate.minMinutes}–{estimate.maxMinutes} min left
          </span>
        ) : null}
      </div>

      {/* Determinate budget bar: honest progress even during a silent gap. */}
      {running && state.budgetMinutes > 0 && state.startedAt ? (
        <div
          style={{
            height: 4,
            borderRadius: 999,
            background: "var(--surface-2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, ((Date.now() - new Date(state.startedAt).getTime()) / (state.budgetMinutes * 60_000)) * 100)}%`,
              background: "var(--accent)",
            }}
          />
        </div>
      ) : null}

      {state.danger ? (
        <div
          role="alert"
          className="stack"
          style={{
            gap: 6,
            padding: "var(--space-3)",
            borderRadius: "var(--radius-sm)",
            background: "var(--danger-bg)",
            borderLeft: "3px solid var(--danger)",
          }}
        >
          <strong style={{ color: "var(--danger)" }}>
            {dangerCopy(state.danger.reason).headline}
          </strong>
          <span style={{ fontSize: 13 }}>{dangerCopy(state.danger.reason).what}</span>
          {state.danger.hashtag ? (
            <span className="muted" style={{ fontSize: 12 }}>
              Stopped while visiting #{state.danger.hashtag}
              {state.danger.url ? ` (${state.danger.url})` : ""}
            </span>
          ) : null}
          <span style={{ fontSize: 13, fontWeight: 600 }}>{DANGER_REMEDY}</span>
        </div>
      ) : null}

      {running && state.waitUntil ? (
        <GapCountdown waitUntil={state.waitUntil} next={state.waitingNext} />
      ) : null}

      <HashtagChecklist state={state} />

      <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
        <span className={silentMinutes > 8 ? "" : "muted"} style={silentMinutes > 8 ? { color: "var(--warn)" } : undefined}>
          {state.lastEventAt ? `last update ${relativeTime(state.lastEventAt)}` : "no updates yet"}
          {silentMinutes > 12 ? " — longer than expected; check the terminal window" : ""}
        </span>
        {running ? (
          <span className="row" style={{ gap: "var(--space-2)" }}>
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
