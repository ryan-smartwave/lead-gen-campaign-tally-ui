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
    <div className="card relative gap-1 overflow-hidden pl-5">
      {/* Identity keyline: colour lives on the mark, never on the number. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-1 rounded-r-full"
        style={{ background: accent ?? "var(--color-line)" }}
      />
      <span className="label">{label}</span>
      <span className="metric">{num(value)}</span>
      <span className="muted text-xs">
        {qualifier ? qualifier : change === undefined ? " " : `${delta(change)} this run`}
      </span>
    </div>
  );
}
