export function EmptyState({
  glyph = "◌",
  headline,
  hint,
  children,
}: {
  glyph?: string;
  headline: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{ alignItems: "center", textAlign: "center", padding: "var(--space-6)" }}
    >
      <span aria-hidden="true" style={{ fontSize: 28, color: "var(--ink-soft)" }}>
        {glyph}
      </span>
      <p style={{ fontWeight: 600 }}>{headline}</p>
      {hint ? (
        <p className="muted" style={{ maxWidth: "46ch" }}>
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}
