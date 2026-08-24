import { delta, num } from "@/lib/format";

export function StatTile({
  label,
  value,
  change,
  accent,
  qualifier,
}: {
  label: string;
  value: number;
  /** Movement since the previous run, when it's meaningful. */
  change?: number;
  /** A CSS colour token, for the platform tiles. */
  accent?: string;
  /** e.g. "so far" while a run is mid-flight. */
  qualifier?: string;
}) {
  return (
    <div className="card" style={{ gap: "var(--space-1)" }}>
      <span className="label" style={accent ? { color: accent } : undefined}>
        {label}
      </span>
      <span className="metric">{num(value)}</span>
      <span className="muted" style={{ fontSize: 12 }}>
        {qualifier ? qualifier : change === undefined ? " " : `${delta(change)} this run`}
      </span>
    </div>
  );
}
