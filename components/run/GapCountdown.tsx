"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/format";
import type { Target } from "@/lib/types";

/**
 * The anti-frozen-spinner device.
 *
 * Between hashtags the scraper waits 3–7 random minutes and emits nothing at
 * all. Without a local countdown the UI looks hung during the longest, most
 * anxious part of the run — and the wait is the single most important anti-ban
 * behaviour, so it's worth explaining rather than hiding.
 */
export function GapCountdown({ waitUntil, next }: { waitUntil: number; next: Target | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Recomputed from an absolute deadline, so a backgrounded tab can't drift.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = waitUntil - now;
  if (remaining <= 0) return null;

  return (
    <div className="stack" style={{ gap: 4 }}>
      <span style={{ fontWeight: 600 }}>
        Waiting {countdown(remaining)}
        {next ? (
          <span className="muted" style={{ fontWeight: 400 }}> before #{next.hashtag}</span>
        ) : null}
      </span>
      <span className="muted" style={{ fontSize: 12 }}>
        Long random gaps between hashtags are deliberate — they are what keeps the account safe.
      </span>
    </div>
  );
}
