"use client";

import { useState } from "react";

/**
 * Pushes local results to the database for remote viewing. Separate from
 * running a scrape on purpose: syncing touches no platform and is always safe
 * to repeat, since every write is an upsert on a natural key.
 */
export function SyncButton({ dbConfigured }: { dbConfigured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function sync() {
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setFailed(true);
        setMessage(body.message ?? "Sync failed.");
        return;
      }
      setMessage(
        `Synced ${body.runs} run${body.runs === 1 ? "" : "s"}, ${body.tallies} tallies, ${body.distinctPosts} distinct posts.`,
      );
    } catch (err) {
      setFailed(true);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="card-title">Remote viewing</span>
        <button type="button" className="btn btn-sm" onClick={() => void sync()} disabled={busy}>
          {busy ? "Syncing…" : "Sync to database"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {dbConfigured
          ? "Copies local results to your Neon database so you can read them from your phone. Safe to repeat."
          : "No database configured yet. Create a free project at neon.com, put its connection string in web/.env.local as DATABASE_URL, then run npm run db:migrate."}
      </p>
      {message ? (
        <p style={{ fontSize: 13, color: failed ? "var(--danger)" : "var(--ok)" }}>{message}</p>
      ) : null}
    </section>
  );
}
