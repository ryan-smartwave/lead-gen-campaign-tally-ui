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
  // A native date input works in "" (empty) terms; the stored field is null.
  const [campaignStart, setCampaignStart] = useState(business.campaignStart ?? "");
  const [campaignEnd, setCampaignEnd] = useState(business.campaignEnd ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name !== business.name ||
    JSON.stringify(hashtags) !== JSON.stringify(business.hashtags) ||
    (campaignStart || null) !== business.campaignStart ||
    (campaignEnd || null) !== business.campaignEnd;

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
        body: JSON.stringify({
          name,
          hashtags,
          campaignStart: campaignStart || null,
          campaignEnd: campaignEnd || null,
        }),
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
      <div className="row justify-between">
        <span className="card-title">{business.name}</span>
        <span className="row gap-2">
          <span className="muted mono text-xs">{business.slug}</span>
          <a href={`/?b=${encodeURIComponent(business.slug)}`} className="text-[13px] font-semibold">
            View dashboard →
          </a>
        </span>
      </div>

      {editable ? (
        <label className="stack gap-1">
          <span className="label">Name</span>
          <input
            className="input w-[min(340px,100%)]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      ) : null}

      {editable ? (
        <div className="stack gap-1">
          <span className="label">Campaign window (optional)</span>
          <div className="row gap-2">
            <label className="stack gap-1">
              <span className="muted text-xs">Start</span>
              <input
                type="date"
                className="input input-sm"
                value={campaignStart}
                max={campaignEnd || undefined}
                onChange={(e) => setCampaignStart(e.target.value)}
              />
            </label>
            <label className="stack gap-1">
              <span className="muted text-xs">End</span>
              <input
                type="date"
                className="input input-sm"
                value={campaignEnd}
                min={campaignStart || undefined}
                onChange={(e) => setCampaignEnd(e.target.value)}
              />
            </label>
          </div>
          <p className="muted text-xs">
            When set, the dashboard counts a post as “in-campaign” only if it was posted inside this
            window. Posts of unknown age still count. Leave blank to count every new post.
          </p>
        </div>
      ) : business.campaignStart || business.campaignEnd ? (
        <p className="muted text-[13px]">
          Campaign window: {business.campaignStart ?? "open"} → {business.campaignEnd ?? "open"}
        </p>
      ) : null}

      <div className="stack gap-2">
        <span className="label">Hashtags ({hashtags.length})</span>
        {hashtags.length === 0 ? (
          <p className="muted text-[13px]">None yet. A scrape needs at least one.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {hashtags.map((h, i) => (
              <li key={`${h.platform}:${h.hashtag}`} className="list-row flex-nowrap gap-2">
                <PlatformIcon platform={h.platform} />
                <span className="font-semibold">#{h.hashtag}</span>
                {editable ? (
                  <button
                    type="button"
                    className="btn btn-sm ml-auto"
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
          <div className="row gap-2">
            <select
              className="select"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
            <input
              className="input input-sm min-w-[140px] flex-1"
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
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}
          {saved && !dirty ? <p className="text-[13px] text-ok">Saved.</p> : null}

          <div className="row justify-between">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={busy || !dirty}
            >
              {busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
            </button>

            {confirmDelete ? (
              <span className="row gap-2">
                <span className="muted text-xs">Scraped data is kept.</span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  Really remove
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(false)}>
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
                Remove campaign
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="muted text-[13px]">
          Read-only here. Campaigns and hashtags are edited on the machine that runs the scraper.
        </p>
      )}
    </section>
  );
}
