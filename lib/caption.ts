/**
 * Caption handling.
 *
 * Real captions are long, multi-line, emoji-heavy, and stuffed with @mentions
 * and #hashtags. Two jobs here: split a caption into spans so the tag spam can
 * recede visually and the human sentence can read, and pull out the @mentions,
 * which are the genuinely valuable signal (they name suppliers).
 *
 * Truncation is deliberately NOT done here — it belongs in CSS line-clamp.
 * Slicing an emoji-heavy string in JS splits grapheme clusters and mangles
 * flags, skin-tone modifiers, and ZWJ sequences.
 */

export type Token =
  | { kind: "text"; value: string }
  | { kind: "mention"; value: string; handle: string }
  | { kind: "hashtag"; value: string; tag: string };

// Instagram handles: letters, digits, underscore, period; 1-30 chars.
const PATTERN = /(@[A-Za-z0-9._]{1,30})|(#[\p{L}\p{N}_]+)/gu;

export function tokenizeCaption(caption: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of caption.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) tokens.push({ kind: "text", value: caption.slice(last, start) });
    const value = m[0];
    if (m[1]) {
      // Trailing periods are almost always sentence punctuation, not the handle.
      const handle = value.slice(1).replace(/\.+$/, "");
      if (handle) tokens.push({ kind: "mention", value, handle });
      else tokens.push({ kind: "text", value });
    } else {
      tokens.push({ kind: "hashtag", value, tag: value.slice(1) });
    }
    last = start + value.length;
  }
  if (last < caption.length) tokens.push({ kind: "text", value: caption.slice(last) });
  return tokens;
}

/** Deduped @handles in first-appearance order, lowercased for comparison. */
export function extractMentions(caption: string | null): string[] {
  if (!caption) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenizeCaption(caption)) {
    if (token.kind !== "mention") continue;
    const key = token.handle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token.handle);
  }
  return out;
}

/** Count mentions across many captions — the supplier signal, ranked. */
export function rankMentions(
  captions: (string | null)[],
): { handle: string; count: number }[] {
  const counts = new Map<string, { handle: string; count: number }>();
  for (const caption of captions) {
    for (const handle of extractMentions(caption)) {
      const key = handle.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { handle, count: 1 });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.handle.localeCompare(b.handle),
  );
}

/** The automation layer hides person names behind this literal. */
export const REDACTED = "<redacted>";

export function isRedacted(author: string | null): boolean {
  return author === REDACTED;
}
