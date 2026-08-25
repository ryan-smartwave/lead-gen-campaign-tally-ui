/**
 * The scraper's live safety limits, read-only.
 *
 * These values ARE the anti-ban design, so the app never edits them — but
 * "edited only in a file" must not mean invisible: an operator deciding
 * whether a run is behaving needs the numbers actually in force, not the
 * documentation's defaults. Rendered from the service's preflight, so this
 * always shows what the next run will really do.
 */

type SafetyValue = number | number[] | boolean;
type SafetyValues = Record<string, SafetyValue>;

const minutes = (ms: number) =>
  ms % 60_000 === 0 ? `${ms / 60_000} min` : `${Math.round(ms / 6_000) / 10} min`;
const seconds = (ms: number) => (ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`);
const spanSec = ([a, b]: number[]) => `${seconds(a)}–${seconds(b)}`;
const spanMin = ([a, b]: number[]) => `${minutes(a)}–${minutes(b)}`;

/** Label + human formatting per limit; unknown keys fall back to raw values. */
const SPEC: Record<
  string,
  { label: string; note: string; format: (v: SafetyValue) => string }
> = {
  maxHashtagsPerRun: {
    label: "Hashtags per run",
    note: "extra hashtags rotate in on later runs",
    format: (v) => String(v),
  },
  maxRunMinutes: {
    label: "Run time budget",
    note: "the run stops itself at this ceiling",
    format: (v) => `${v} min`,
  },
  scrollsPerHashtag: {
    label: "Scrolls per page",
    note: "reads the top of each feed, not its depth",
    format: (v) => String(v),
  },
  scrollPauseMs: {
    label: "Pause between scrolls",
    note: "randomized every scroll",
    format: (v) => spanSec(v as number[]),
  },
  initialDwellMs: {
    label: "Dwell after page load",
    note: "a human looks before scrolling",
    format: (v) => spanSec(v as number[]),
  },
  gapBetweenHashtagsMs: {
    label: "Gap between hashtags",
    note: "the long waits that keep the account safe",
    format: (v) => spanMin(v as number[]),
  },
  startJitterMs: {
    label: "Randomized start delay",
    note: "so daily runs never share a clock rhythm",
    format: (v) => spanMin(v as number[]),
  },
  pageLoadDelayMs: {
    label: "Page-load wait",
    note: "before the page is trusted to have settled",
    format: (v) => seconds(v as number),
  },
  maxPostVisitsPerRun: {
    label: "Post visits per run",
    note: "capped extra page opens to fill in likes, captions and dates",
    format: (v) => String(v),
  },
  pipelineTabs: {
    label: "Tab pipelining",
    note: "pre-loads the next hashtag during the gap — one tab active at a time",
    format: (v) => (v ? "on" : "off"),
  },
  journalRetentionDays: {
    label: "Forensic journal kept",
    note: "per-run action log, for diagnosing any block",
    format: (v) => `${v} days`,
  },
};

export function SafetySpec({ safety }: { safety: SafetyValues | null }) {
  return (
    <section className="card">
      <div className="row justify-between">
        <span className="card-title">Scrape safety limits</span>
        <span className="pill">read-only</span>
      </div>

      {safety ? (
        <dl className="m-0 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {Object.entries(SPEC)
            .filter(([key]) => key in safety)
            .map(([key, spec]) => (
              <div
                key={key}
                className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0 sm:nth-last-2:border-b-0"
              >
                <dt className="text-[13px]">
                  <span className="font-semibold">{spec.label}</span>{" "}
                  <span className="muted">— {spec.note}</span>
                </dt>
                <dd className="num m-0 text-[13px] font-semibold whitespace-nowrap">
                  {spec.format(safety[key])}
                </dd>
              </div>
            ))}
        </dl>
      ) : (
        <p className="muted text-[13px]">
          The scraper service is not reachable from here, so the limits in force can be read only
          on the machine that runs it.
        </p>
      )}

      <p className="muted text-xs">
        Shared by every business and edited only in <span className="mono">scraper/config.json</span>,
        never from this app — these timings are what keeps the accounts from being flagged, so
        there is deliberately no button here that can widen them.
      </p>
    </section>
  );
}
