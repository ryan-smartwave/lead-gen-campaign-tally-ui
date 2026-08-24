"use client";

import { useMemo, useState } from "react";
import type { Series } from "@/lib/types";
import { dayLabel, num } from "@/lib/format";
import { niceMax, plotArea, seriesColor, stepPath, ticks } from "./scale";

/**
 * Cumulative unique posts per hashtag — the campaign's core signal.
 *
 * Client-side only for the legend toggles and hover crosshair; the geometry is
 * the same pure step-path used elsewhere. Steps, not straight lines: a hashtag
 * may have no observation on a given day and its total simply holds.
 */
export function CumulativeChart({ series }: { series: Series[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const days = useMemo(() => {
    const all = new Set<string>();
    for (const s of series) for (const p of s.points) all.add(p.day);
    return [...all].sort();
  }, [series]);

  const visible = series.filter((s) => !hidden.has(key(s)));

  const box = { width: 720, height: 260, pad: { top: 12, right: 10, bottom: 26, left: 38 } };
  const area = plotArea(box);
  const max = niceMax(
    Math.max(1, ...visible.flatMap((s) => s.points.map((p) => p.cumulative))),
  );

  if (days.length < 2) return null;

  const xAt = (i: number) =>
    days.length === 1 ? area.x0 + area.w / 2 : area.x0 + (i / (days.length - 1)) * area.w;

  function toggle(k: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const labelEvery = Math.ceil(days.length / 8);

  return (
    <div className="stack">
      <div className="row" style={{ gap: "var(--space-2)" }}>
        {series.map((s, i) => {
          const k = key(s);
          const off = hidden.has(k);
          return (
            <button
              key={k}
              type="button"
              className="pill"
              onClick={() => toggle(k)}
              aria-pressed={!off}
              style={{
                cursor: "pointer",
                opacity: off ? 0.45 : 1,
                borderColor: off ? "var(--line)" : seriesColor(i),
              }}
              title={off ? `Show #${s.hashtag}` : `Hide #${s.hashtag}`}
            >
              <span aria-hidden="true" style={{ color: seriesColor(i) }}>
                ●
              </span>
              #{s.hashtag}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        width="100%"
        style={{ height: "auto", minHeight: 200 }}
        role="img"
        aria-label={`Cumulative unique posts per hashtag across ${days.length} days.`}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * box.width;
          const ratio = (px - area.x0) / area.w;
          const idx = Math.round(ratio * (days.length - 1));
          setHoverIdx(idx >= 0 && idx < days.length ? idx : null);
        }}
      >
        {ticks(max).map((t) => {
          const y = area.y1 - (t / max) * area.h;
          return (
            <g key={t}>
              <line x1={area.x0} y1={y} x2={area.x1} y2={y} stroke="var(--line)" />
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

        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d}
              x={xAt(i)}
              y={box.height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink-soft)"
            >
              {dayLabel(d).replace("Today", "today").replace("Yesterday", "yest.")}
            </text>
          ) : null,
        )}

        {hoverIdx !== null ? (
          <line
            x1={xAt(hoverIdx)}
            y1={area.y0}
            x2={xAt(hoverIdx)}
            y2={area.y1}
            stroke="var(--ink-soft)"
            strokeDasharray="3 3"
          />
        ) : null}

        {series.map((s, i) => {
          if (hidden.has(key(s))) return null;
          const byDay = new Map(s.points.map((p) => [p.day, p.cumulative]));
          const values = days.map((d) => byDay.get(d) ?? null);
          return (
            <path
              key={key(s)}
              d={stepPath(values, max, area)}
              fill="none"
              stroke={seriesColor(i)}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      {hoverIdx !== null ? (
        <div className="card" style={{ padding: "var(--space-3)", gap: "var(--space-1)" }}>
          <span className="label">{dayLabel(days[hoverIdx])}</span>
          {visible.map((s, i) => {
            const point = s.points.find((p) => p.day === days[hoverIdx]);
            if (!point) return null;
            return (
              <div key={key(s)} className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 13 }}>
                  <span aria-hidden="true" style={{ color: seriesColor(series.indexOf(s)) }}>
                    ●
                  </span>{" "}
                  #{s.hashtag}
                </span>
                <span className="num" style={{ fontSize: 13 }}>
                  {num(point.cumulative)}
                  {point.newPosts > 0 ? (
                    <span className="muted"> (+{point.newPosts})</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function key(s: Series): string {
  return `${s.platform}:${s.hashtag}`;
}
