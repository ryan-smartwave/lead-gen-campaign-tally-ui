"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Adds a business. Its hashtags are added afterwards, in its own editor. */
export function NewBusiness() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, hashtags: [] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? "Could not add the business.");
        return;
      }
      setName("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <span className="card-title">Add a business</span>
      <p className="muted" style={{ fontSize: 13 }}>
        Each business keeps its own hashtags, history, and duplicate-tracking, so their numbers
        never mix. They share the browser connection, so only one can be scraping at a time.
      </p>
      <div className="row" style={{ gap: "var(--space-2)" }}>
        <input
          className="btn"
          style={{ justifyContent: "flex-start", cursor: "text", flex: 1, minWidth: 180 }}
          placeholder="e.g. Bloom Wedding Planning"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void create()}
          disabled={busy || !name.trim()}
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error ? (
        <p role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
