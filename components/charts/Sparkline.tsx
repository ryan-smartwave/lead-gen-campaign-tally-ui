import { polylinePoints } from "./scale";

/** Tiny cumulative shape for a table row. No client JS, no axes, no labels. */
export function Sparkline({
  values,
  color,
  width = 64,
  height = 20,
  label,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  label: string;
}) {
  if (values.length < 2) {
    return <span className="muted" style={{ fontSize: 12 }}>—</span>;
  }
  const points = polylinePoints(values, width - 2, height - 2);
  const last = values[values.length - 1];
  const max = Math.max(...values, 1);
  const endY = height - 1 - ((last / max) * (height - 2));
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      style={{ overflow: "visible" }}
    >
      <g transform="translate(1,1)">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
      <circle cx={width - 1} cy={endY} r="2" fill={color} />
    </svg>
  );
}
