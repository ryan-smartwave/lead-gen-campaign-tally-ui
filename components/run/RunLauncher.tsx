"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Preflight } from "@/lib/types";
import { useRunStream } from "./useRunStream";
import { RunProgress } from "./RunProgress";
import { PreflightPanel, BridgeRemedy } from "./PreflightPanel";

/** Owns the whole run lifecycle: preflight, the button, and live progress. */
export function RunLauncher({
  canRun,
  local = false,
  ranToday,
  campaign,
  hashtagCount,
}: {
  canRun: boolean;
  /** True when the scraper service is reachable from here (same machine). */
  local?: boolean;
  ranToday: boolean;
  campaign: string;
  hashtagCount: number;
}) {
  const router = useRouter();
  const { state, connected, refresh } = useRunStream();
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);

  const loadPreflight = useCallback(async () => {
    try {
      const res = await fetch(`/api/preflight?campaign=${encodeURIComponent(campaign)}`, {
        cache: "no-store",
      });
      setPreflight(await res.json());
    } catch {
      setError("Could not reach the app's own API. Is the dev server still running?");
    }
  }, [campaign]);

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  // When a run finishes, pull fresh server-rendered numbers into the page.
  const runFinished = state && state.status !== "running";
  useEffect(() => {
    if (runFinished) {
      void loadPreflight();
      router.refresh();
    }
  }, [runFinished, loadPreflight, router]);

  async function start(force: boolean) {
    setBusy(true);
    setError(null);
    setHint(null);
    setConfirmForce(false);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, campaign }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === "already_ran_today" || body.error === "aborted_today") {
          setConfirmForce(true);
          setError(body.message);
        } else {
          setError(body.message ?? "Could not start the run.");
          if (body.hint) setHint(body.hint);
        }
        return;
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stopRun() {
    await fetch("/api/run", { method: "DELETE" }).catch(() => {});
    await refresh();
  }

  /** Clears a finished run's panel. The results stay in the database. */
  async function dismiss() {
    setBusy(true);
    try {
      await fetch("/api/run/active", { method: "DELETE" }).catch(() => {});
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const running = state?.status === "running";

  // A live or just-finished run replaces the launcher entirely.
  if (state) {
    return (
      <>
        <RunProgress
          state={state}
          connected={connected}
          local={local}
          onStop={running ? stopRun : undefined}
        />
        {!running ? (
          <div className="row">
            <button type="button" className="btn" onClick={() => void dismiss()} disabled={busy}>
              Dismiss
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void start(true)}
              disabled={busy || !canRun}
            >
              Run again anyway
            </button>
            <span className="muted text-xs">
              Only if you understand why — one run a day is the design.
            </span>
          </div>
        ) : null}
      </>
    );
  }

  // Nothing to scrape yet — point at the fix rather than showing a dead button.
  if (hashtagCount === 0) {
    return (
      <section className="card">
        <span className="card-title">No hashtags yet</span>
        <p className="muted text-[13px]">
          This campaign has no hashtags to track.{" "}
          <Link href="/settings">Add some in settings</Link> and the run button appears.
        </p>
      </section>
    );
  }

  // Honest read-only state: no disabled button to puzzle over.
  if (!canRun) {
    return (
      <section className="card">
        <span className="label">Scrapes</span>
        <p className="muted">
          Read-only view. Scrapes run on the laptop, where Chrome is signed in to Instagram and
          Facebook.
        </p>
      </section>
    );
  }

  const mcp = preflight?.checks.find((c) => c.id === "mcp");
  const blocked = mcp?.status === "fail";

  return (
    <section className="card">
      <div className="row justify-between">
        <span className="card-title">Run a scrape</span>
        {preflight ? (
          <button type="button" className="btn btn-sm" onClick={() => void loadPreflight()}>
            Re-check
          </button>
        ) : null}
      </div>

      <PreflightPanel preflight={preflight} />

      {blocked && mcp?.remedy === "mcp_unreachable" ? <BridgeRemedy /> : null}

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? <p className="muted text-xs">{hint}</p> : null}

      <div className="row">
        {confirmForce ? (
          <>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void start(true)}
              disabled={busy}
            >
              Run anyway
            </button>
            <button type="button" className="btn" onClick={() => setConfirmForce(false)}>
              Cancel
            </button>
          </>
        ) : (
          // Visual weight follows the recommendation: the confident teal
          // button belongs to the run that hasn't happened yet, while a rerun
          // is discouraged and dresses accordingly.
          <button
            type="button"
            className={ranToday ? "btn" : "btn btn-primary"}
            onClick={() => void start(false)}
            disabled={busy || blocked}
          >
            {busy ? "Starting…" : ranToday ? "Run again" : "Run scrape"}
          </button>
        )}
        <span className="muted text-xs">
          {ranToday
            ? "Already ran today — one run a day is the design."
            : `${hashtagCount} hashtag${hashtagCount === 1 ? "" : "s"} · takes 30–60 minutes; you can close this page.`}
        </span>
      </div>
    </section>
  );
}

