/**
 * @handles pulled out of a caption as chips.
 *
 * These are the genuinely valuable signal in wedding-campaign captions: the
 * mentions name the suppliers (planners, venues, photographers), so they earn
 * promotion out of the text wall.
 */
export function MentionChips({ handles, max = 6 }: { handles: string[]; max?: number }) {
  if (handles.length === 0) return null;
  const shown = handles.slice(0, max);
  const rest = handles.length - shown.length;

  return (
    <div className="row" style={{ gap: 4 }}>
      {shown.map((handle) => (
        <a
          key={handle}
          className="pill"
          href={`https://www.instagram.com/${handle}/`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", fontWeight: 500 }}
        >
          @{handle}
        </a>
      ))}
      {rest > 0 ? <span className="muted" style={{ fontSize: 12 }}>+{rest} more</span> : null}
    </div>
  );
}
