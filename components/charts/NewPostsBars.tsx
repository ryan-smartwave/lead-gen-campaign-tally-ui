import { dayLabel } from "@/lib/format";
import { niceMax, plotArea, ticks } from "./scale";

interface DayDatum {
  day: string;
  instagram: number;
  facebook: number;
  total: number;
}

/**
 * Newly discovered posts per day, stacked by platform. Server-rendered.
 *
 * "Newly discovered" is load-bearing wording: posts are deduped for the life of
 * the campaign, so this number naturally trends down as coverage saturates.
 * That is the design working, not the campaign dying — the cumulative chart is
 * the headline metric.
 */
export function NewPostsBars({
  data,
  flags = {},
}: {
  data: DayDatum[];
  /** day -> "aborted" | "budget_stopped", so a short bar is explained. */
  flags?: Record<string, "aborted" | "budget_stopped">;
}) {
  if (data.length === 0) return null;

  const box = {
    width: 720,
    height: 200,
    pad: { top: 12, right: 8, bottom: 26, left: 34 },
  };
  const area = plotArea(box);
  const max = niceMax(Math.max(...data.map((d) => d.total), 1));
  const slot = area.w / data.length;
  const barW = Math.max(3, Math.min(28, slot * 0.62));

  // With many days, only label a few so the axis stays readable.
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <svg
      viewBox={`0 0 ${box.width} ${box.height}`}
      width="100%"
      style={{ height: "auto", minHeight: 160 }}
      role="img"
      aria-label={`Newly discovered posts per day. ${data.length} days, peak ${max}.`}
    >
      {ticks(max).map((t) => {
        const y = area.y1 - (t / max) * area.h;
        return (
          <g key={t}>
            <line x1={area.x0} y1={y} x2={area.x1} y2={y} stroke="var(--line)" strokeWidth="1" />
            <text
              x={area.x0 - 6}
              y={y + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--ink-soft)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const cx = area.x0 + i * slot + slot / 2;
        const x = cx - barW / 2;
        const igH = (d.instagram / max) * area.h;
        const fbH = (d.facebook / max) * area.h;
        const flag = flags[d.day];
        return (
          <g key={d.day}>
            {fbH > 0 ? (
              <rect x={x} y={area.y1 - fbH} width={barW} height={fbH} fill="var(--facebook)" rx="1" />
            ) : null}
            {igH > 0 ? (
              <rect
                x={x}
                y={area.y1 - fbH - igH}
                width={barW}
                height={igH}
                fill="var(--instagram)"
                rx="1"
              />
            ) : null}
            {flag ? (
              <rect
                x={x}
                y={area.y1 + 2}
                width={barW}
                height="2.5"
                fill={flag === "aborted" ? "var(--danger)" : "var(--warn)"}
              />
            ) : null}
            {i % labelEvery === 0 ? (
              <text
                x={cx}
                y={box.height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--ink-soft)"
              >
                {dayLabel(d.day).replace("Today", "today").replace("Yesterday", "yest.")}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
