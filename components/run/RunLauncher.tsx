"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Check, Preflight } from "@/lib/types";
import { MCP_STALE_STEPS } from "@/lib/dangerCopy";
import { useRunStream } from "./useRunStream";
import { RunProgress } from "./RunProgress";

/** Owns the whole run lifecycle: preflight, the button, and live progress. */
export function RunLauncher({
  canRun,
  ranToday,
  business,
  hashtagCount,
}: {
  canRun: boolean;
  ranToday: boolean;
  business: string;
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
      const res = await fetch(`/api/preflight?business=${encodeURIComponent(business)}`, {
        cache: "no-store",
      });
      setPreflight(await res.json());
    } catch {
      setError("Could not reach the app's own API. Is the dev server still running?");
    }
  }, [business]);

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
        body: JSON.stringify({ force, business }),
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
        <RunProgress state={state} connected={connected} onStop={running ? stopRun : undefined} />
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
          This business has no hashtags to track.{" "}
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
  // Green plumbing is noise: collapse the checklist when nothing needs a
  // human, expand it whenever any check does.
  const allQuiet =
    preflight != null &&
    preflight.checks.every((c) => c.status === "pass" || c.status === "not_checked");

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

      {allQuiet ? (
        <details className="group rounded-[var(--radius-ctl)] bg-surface-2 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] select-none [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="grid h-[18px] w-[18px] place-items-center rounded-full bg-ok-bg text-[11px] font-bold text-ok"
            >
              ✓
            </span>
            <span className="font-semibold">All checks passed</span>
            <span className="muted">— ready to run</span>
            <span aria-hidden="true" className="muted ml-auto text-[11px] transition-transform group-open:rotate-90">
              ▶
            </span>
          </summary>
          <div className="stack mt-2 gap-1.5">
            {preflight.checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </details>
      ) : (
        <div className="stack gap-1.5 rounded-[var(--radius-ctl)] bg-surface-2 p-3">
          {(preflight?.checks ?? []).map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
          {!preflight ? <span className="muted">Checking…</span> : null}
        </div>
      )}

      {blocked && mcp?.remedy === "mcp_unreachable" ? (
        <div className="stack gap-1.5 rounded-[var(--radius-ctl)] border-l-[3px] border-warn bg-warn-bg p-3">
          <strong className="text-[13px]">Start the Chrome bridge</strong>
          <ol className="stack m-0 gap-1 pl-[1.2em] text-[13px]">
            {MCP_STALE_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

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
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void start(false)}
            disabled={busy || blocked}
          >
            {busy ? "Starting…" : "Run scrape"}
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

const CHECK_LOOK = {
  pass: { glyph: "✓", cls: "text-ok bg-ok-bg" },
  fail: { glyph: "×", cls: "text-danger bg-danger-bg" },
  warn: { glyph: "!", cls: "text-warn bg-warn-bg" },
  not_checked: { glyph: "·", cls: "text-ink-soft bg-surface" },
  stale: { glyph: "◔", cls: "text-warn bg-warn-bg" },
} as const;

function CheckRow({ check }: { check: Check }) {
  const look = CHECK_LOOK[check.status];
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className={`mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${look.cls}`}
      >
        {look.glyph}
      </span>
      <span className="text-[13px]">
        <span className="font-semibold">{check.label}</span>{" "}
        <span className="muted">{check.detail}</span>
      </span>
    </div>
  );
}
