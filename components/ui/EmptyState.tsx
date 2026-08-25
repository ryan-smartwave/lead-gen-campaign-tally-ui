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
    <div className="card items-center gap-3 border-dashed py-10 text-center shadow-none">
      <span
        aria-hidden="true"
        className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-[26px] text-ink-soft"
      >
        {glyph}
      </span>
      <p className="card-title">{headline}</p>
      {hint ? <p className="muted max-w-[46ch]">{hint}</p> : null}
      {children}
    </div>
  );
}
