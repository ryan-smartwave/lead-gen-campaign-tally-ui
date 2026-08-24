"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business, Platform, Target } from "@/lib/types";
import { PlatformIcon } from "@/components/data/PlatformIcon";

/**
 * Edits one business: its name and its hashtag list.
 *
 * Saves write to the scraper's own files, so the CLI and the app always read
 * the same definitions. Safety settings are deliberately absent here — those
 * are the anti-ban limits and stay file-only.
 */
export function BusinessEditor({
  business,
  editable,
}: {
  business: Business;
  editable: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(business.name);
  const [hashtags, setHashtags] = useState<Target[]>(business.hashtags);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name !== business.name ||
    JSON.stringify(hashtags) !== JSON.stringify(business.hashtags);

  function addHashtag() {
    // Accept a pasted "#tag" or a full URL and keep just the tag.
    const cleaned = draft
      .trim()
      .replace(/^.*\/(?:tags|hashtag)\//, "")
      .replace(/^#/, "")
      .replace(/\/$/, "");
    if (!cleaned) return;
    if (hashtags.some((h) => h.platform === platform && h.hashtag === cleaned)) {
      setError(`#${cleaned} is already tracked on ${platform}.`);
      return;
    }
    setError(null);
    setHashtags([...hashtags, { platform, hashtag: cleaned }]);
    setDraft("");
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(business.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, hashtags }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? "Could not save.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/businesses/${encodeURIComponent(business.slug)}`, { method: "DELETE" });
      router.refresh();
      router.push("/settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="card-title">{business.name}</span>
        <span className="muted mono" style={{ fontSize: 12 }}>
          {business.slug}
        </span>
      </div>

      {editable ? (
        <label className="stack" style={{ gap: 4 }}>
          <span className="label">Name</span>
          <input
            className="btn"
            style={{ justifyContent: "flex-start", cursor: "text", width: "min(340px, 100%)" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      ) : null}

      <div className="stack" style={{ gap: "var(--space-2)" }}>
        <span className="label">Hashtags ({hashtags.length})</span>
        {hashtags.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            None yet. A scrape needs at least one.
          </p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, gap: 6 }}>
            {hashtags.map((h, i) => (
              <li
                key={`${h.platform}:${h.hashtag}`}
                className="row"
                style={{ gap: "var(--space-2)", flexWrap: "nowrap" }}
              >
                <PlatformIcon platform={h.platform} />
                <span style={{ fontWeight: 600 }}>#{h.hashtag}</span>
                {editable ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginLeft: "auto" }}
                    onClick={() => setHashtags(hashtags.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editable ? (
        <>
          <div className="row" style={{ gap: "var(--space-2)" }}>
            <select
              className="btn btn-sm"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
            <input
              className="btn btn-sm"
              style={{ justifyContent: "flex-start", cursor: "text", flex: 1, minWidth: 140 }}
              placeholder="hashtag, without the #"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHashtag();
                }
              }}
            />
            <button type="button" className="btn btn-sm" onClick={addHashtag}>
              Add
            </button>
          </div>

          {error ? (
            <p role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
              {error}
            </p>
          ) : null}
          {saved && !dirty ? (
            <p style={{ color: "var(--ok)", fontSize: 13 }}>Saved.</p>
          ) : null}

          <div className="row" style={{ justifyContent: "space-between" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={busy || !dirty}
            >
              {busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
            </button>

            {confirmDelete ? (
              <span className="row" style={{ gap: "var(--space-2)" }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Scraped data is kept.
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  Really remove
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Remove business
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>
          Read-only here. Businesses and hashtags are edited on the machine that runs the scraper.
        </p>
      )}
    </section>
  );
}
