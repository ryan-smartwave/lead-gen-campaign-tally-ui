/** Pure scale/path helpers for the hand-rolled SVG charts. */

export interface Box {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
}

export function plotArea(box: Box) {
  return {
    x0: box.pad.left,
    y0: box.pad.top,
    x1: box.width - box.pad.right,
    y1: box.height - box.pad.bottom,
    w: box.width - box.pad.left - box.pad.right,
    h: box.height - box.pad.top - box.pad.bottom,
  };
}

/** A "nice" upper bound so gridlines land on round numbers. */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

export function ticks(max: number, count = 4): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step));
}

/**
 * Step path (horizontal-then-vertical). Cumulative counts hold their value
 * between observations, so a straight interpolation would draw growth that
 * never happened.
 */
export function stepPath(
  values: (number | null)[],
  max: number,
  area: ReturnType<typeof plotArea>,
): string {
  const n = values.length;
  if (n === 0) return "";
  const xAt = (i: number) => (n === 1 ? area.x0 + area.w / 2 : area.x0 + (i / (n - 1)) * area.w);
  const yAt = (v: number) => area.y1 - (max === 0 ? 0 : (v / max) * area.h);

  let d = "";
  let prevY: number | null = null;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null) continue;
    const x = xAt(i);
    const y = yAt(v);
    if (prevY === null) {
      d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      d += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    prevY = y;
  }
  return d;
}

/** Straight polyline points, for sparklines where the shape is all that matters. */
export function polylinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const n = values.length;
  return values
    .map((v, i) => {
      const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
      const y = height - (v / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Series colour tokens. Eight CVD-validated slots defined in globals.css,
 * re-stepped per theme; assigned in fixed order by series index.
 */
export function seriesColor(index: number): string {
  return `var(--series-${(index % 8) + 1})`;
}
