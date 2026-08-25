"use client";

import { useState } from "react";

/**
 * A post thumbnail that removes itself if the image fails to load.
 *
 * Instagram's image URLs are signed CDN links that expire, so an older post's
 * thumbnail often 404s. A plain server-rendered <img> would then show the
 * browser's broken-image glyph; hiding on error keeps the card clean. Client
 * component purely for the onError handler.
 */
export function PostThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote CDN URL, not a static asset; next/image would need per-host config for expiring IG links.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: 64,
        height: 64,
        objectFit: "cover",
        borderRadius: "var(--radius-ctl)",
        flexShrink: 0,
        background: "var(--color-surface-2)",
      }}
    />
  );
}
