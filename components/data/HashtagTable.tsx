import type { Platform, Series, TallyRow } from "@/lib/types";
import { delta, num } from "@/lib/format";
import { lastCumulative } from "@/lib/series";
import { seriesColor } from "@/components/charts/scale";
import { Sparkline } from "@/components/charts/Sparkline";
import { PlatformIcon } from "./PlatformIcon";
import { StatusPill } from "./StatusPill";

/**
 * The workhorse view. Seven readable rows beat a seven-line chart on a phone,
 * and it renders entirely on the server with no client JS.
 */
export function HashtagTable({
  series,
  latestRows,
  configuredOnly,
}: {
  series: Series[];
  /** Rows from the most recent run, for the "+new" and status columns. */
  latestRows: TallyRow[];
  configuredOnly: { platform: Platform; hashtag: string }[];
}) {
  const latest = new Map(latestRows.map((r) => [`${r.platform}:${r.hashtag}`, r]));

  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th>Hashtag</th>
            <th className="right">Tallied</th>
            <th className="right">Latest run</th>
            <th>Trend</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s, i) => {
            const key = `${s.platform}:${s.hashtag}`;
            const row = latest.get(key);
            return (
              <tr key={key}>
                <td>
                  <span className="flex items-center gap-1.5">
                    <PlatformIcon platform={s.platform} />
                    <span className="font-semibold">#{s.hashtag}</span>
                  </span>
                </td>
                <td className="right font-semibold">{num(lastCumulative(s))}</td>
                <td className="right muted">
                  {row ? (
                    <>
                      {delta(row.newPosts)}
                      {row.freshPosts !== row.newPosts ? (
                        <span className="muted text-xs"> ({num(row.freshPosts)} in-campaign)</span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Sparkline
                    values={s.points.map((p) => p.cumulative)}
                    color={seriesColor(i)}
                    label={`${s.hashtag} trend: ${s.points.map((p) => p.cumulative).join(", ")}`}
                  />
                </td>
                <td>{row ? <StatusPill status={row.status} /> : <span className="muted">—</span>}</td>
              </tr>
            );
          })}

          {/* Configured but never observed — otherwise these vanish silently. */}
          {configuredOnly.map((h) => (
            <tr key={`${h.platform}:${h.hashtag}`}>
              <td>
                <span className="flex items-center gap-1.5">
                  <PlatformIcon platform={h.platform} />
                  <span className="muted">#{h.hashtag}</span>
                </span>
              </td>
              <td className="right muted">0</td>
              <td className="right muted">—</td>
              <td className="muted text-xs">not yet scraped</td>
              <td>
                <span className="muted">—</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
