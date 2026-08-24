"use client";

import { useState } from "react";
import { tokenizeCaption } from "@/lib/caption";

/**
 * Renders a caption with @mentions promoted and #hashtags de-emphasised, so the
 * human sentence reads instead of drowning in tag spam.
 *
 * Truncation is CSS line-clamp, never a JS slice: these captions are full of
 * emoji, ZWJ sequences and skin-tone modifiers, and slicing by code unit
 * mangles them.
 */
export function Caption({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const tokens = tokenizeCaption(text);

  return (
    <div className="stack" style={{ gap: 4 }}>
      <p
        style={{
          fontSize: 14,
          whiteSpace: "pre-line",
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }),
        }}
      >
        {tokens.map((token, i) =>
          token.kind === "mention" ? (
            <span key={i} style={{ color: "var(--accent)", fontWeight: 600 }}>
              {token.value}
            </span>
          ) : token.kind === "hashtag" ? (
            <span key={i} style={{ color: "var(--ink-soft)" }}>
              {token.value}
            </span>
          ) : (
            <span key={i}>{token.value}</span>
          ),
        )}
      </p>
      {text.length > 140 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--accent)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          {expanded ? "less" : "more"}
        </button>
      ) : null}
    </div>
  );
}
