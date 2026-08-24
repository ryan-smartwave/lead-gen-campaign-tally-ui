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
            <span className="muted" style={{ fontSize: 12 }}>
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
        <p className="muted" style={{ fontSize: 13 }}>
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

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="card-title">Run a scrape</span>
        {preflight ? (
          <button type="button" className="btn btn-sm" onClick={() => void loadPreflight()}>
            Re-check
          </button>
        ) : null}
      </div>

      <div className="stack" style={{ gap: "var(--space-2)" }}>
        {(preflight?.checks ?? []).map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
        {!preflight ? <span className="muted">Checking…</span> : null}
      </div>

      {blocked && mcp?.remedy === "mcp_unreachable" ? (
        <div
          className="stack"
          style={{
            gap: 6,
            padding: "var(--space-3)",
            background: "var(--surface-2)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <strong style={{ fontSize: 13 }}>Start the Chrome bridge</strong>
          <ol className="stack" style={{ gap: 4, margin: 0, paddingLeft: "1.2em", fontSize: 13 }}>
            {MCP_STALE_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {error ? (
        <p style={{ color: "var(--danger)", fontSize: 13 }} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="muted" style={{ fontSize: 12 }}>
          {hint}
        </p>
      ) : null}

      <div className="row">
        {confirmForce ? (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => void start(true)}
              disabled={busy}
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
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
        <span className="muted" style={{ fontSize: 12 }}>
          {ranToday
            ? "Already ran today — one run a day is the design."
            : `${hashtagCount} hashtag${hashtagCount === 1 ? "" : "s"} · takes 30–60 minutes; you can close this page.`}
        </span>
      </div>
    </section>
  );
}

function CheckRow({ check }: { check: Check }) {
  const look = {
    pass: { glyph: "✓", color: "var(--ok)" },
    fail: { glyph: "×", color: "var(--danger)" },
    warn: { glyph: "!", color: "var(--warn)" },
    not_checked: { glyph: "·", color: "var(--ink-soft)" },
    stale: { glyph: "◔", color: "var(--warn)" },
  }[check.status];

  return (
    <div className="row" style={{ gap: "var(--space-2)", alignItems: "flex-start" }}>
      <span aria-hidden="true" style={{ color: look.color, width: 12 }}>
        {look.glyph}
      </span>
      <span style={{ fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{check.label}</span>{" "}
        <span className="muted">{check.detail}</span>
      </span>
    </div>
  );
}
