import type { RunViewState, StopReason, TargetProgress, TargetProgressState } from "@/lib/types";
import { targetKey } from "@/lib/types";
import { fmtSeconds, num } from "@/lib/format";
import { PlatformIcon } from "@/components/data/PlatformIcon";

const GLYPH: Record<TargetProgressState, string> = {
  pending: "○",
  active: "◍",
  done: "✓",
  empty: "∅",
  error: "×",
  never_visited: "—",
};

const COLOR: Record<TargetProgressState, string> = {
  pending: "var(--color-ink-soft)",
  active: "var(--color-accent)",
  done: "var(--color-ok)",
  empty: "var(--color-warn)",
  error: "var(--color-danger)",
  never_visited: "var(--color-ink-soft)",
};

const OUTCOME: Record<TargetProgressState, string> = {
  pending: "Not visited yet.",
  active: "Being scrolled right now.",
  done: "Visited and recorded.",
  empty: "Visited, but the page showed no posts (a restricted or empty feed).",
  error: "The visit failed.",
  never_visited: "The run ended before this hashtag was reached.",
};

function stopReasonCopy(reason: StopReason | undefined, steps?: number): string | null {
  const after = steps ? ` after ${steps} scroll steps` : "";
  switch (reason) {
    case "dry":
      return `Ended early${after}: the feed went dry — several scrolls in a row surfaced nothing the campaign hadn't already recorded, so the remaining time budget wasn't spent.`;
    case "post_cap":
      return `Ended early${after}: it hit the per-hashtag post cap for one run.`;
    case "budget":
      return `Used its full scroll time budget${after}.`;
    case "steps":
      return `Completed its configured scroll steps${after}.`;
    default:
      return null;
  }
}

/** One line inside the expanded panel. */
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row items-baseline gap-2 text-[13px]">
      <span className="muted w-[90px] shrink-0 text-xs">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function ResultLine({ progress }: { progress: TargetProgress }) {
  return (
    <span className="num">
      {progress.state === "done" || progress.state === "empty"
        ? `${num(progress.postsOnPage ?? 0)} on page · +${num(progress.newCount ?? 0)} new${
            progress.freshCount !== undefined && progress.freshCount !== progress.newCount
              ? ` (${num(progress.freshCount)} in-campaign)`
              : ""
          } · ${num(progress.cumulative ?? 0)} total${
            fmtSeconds(progress.durationSeconds) ? ` · ${fmtSeconds(progress.durationSeconds)}` : ""
          }`
        : progress.state === "active"
          ? "loading and scrolling…"
          : progress.state === "error"
            ? (progress.message ?? "failed")
            : progress.state === "never_visited"
              ? "never visited"
              : null}
    </span>
  );
}

/**
 * The ordered target list with per-hashtag state. Each row is an accordion:
 * collapsed it reads like the old one-line checklist; expanded it explains
 * what the visit did and — the part people actually ask about — why it ended
 * when it did.
 */
export function HashtagChecklist({ state }: { state: RunViewState }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {state.targets.map((target, index) => {
        const progress = state.results[targetKey(target)] ?? { state: "pending" as const };
        const isNext = state.waitingNext && targetKey(state.waitingNext) === targetKey(target);
        const active = progress.state === "active";
        const ended = stopReasonCopy(progress.stopReason, progress.scrollSteps);
        return (
          <li
            // Index-qualified: the visit order is the identity here, and a
            // malformed target must not collide with its siblings.
            key={`${index}-${targetKey(target)}`}
            className={`list-row block ${active ? "bg-accent-soft" : ""}`}
          >
            <details>
              <summary className="flex cursor-pointer list-none flex-nowrap items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="w-[14px] shrink-0"
                  style={{ color: COLOR[progress.state] }}
                >
                  {GLYPH[progress.state]}
                </span>
                <PlatformIcon platform={target.platform} />
                <span
                  className={active ? "font-semibold" : undefined}
                  style={{ color: progress.state === "pending" ? "var(--color-ink-soft)" : "var(--color-ink)" }}
                >
                  {target.hashtag ? `#${target.hashtag}` : <em>unnamed target</em>}
                </span>
                <span className="muted num ml-auto text-right text-[13px]">
                  {progress.state === "pending" ? (isNext ? "up next" : "queued") : <ResultLine progress={progress} />}
                </span>
              </summary>

              <div className="stack gap-1 py-2 pl-[22px]">
                <Detail label="Outcome">
                  {OUTCOME[progress.state]}
                  {progress.visitSeq ? ` Visit ${progress.visitSeq} of ${state.targets.length}.` : ""}
                </Detail>
                {progress.state === "done" || progress.state === "empty" ? (
                  <>
                    <Detail label="Result">
                      {num(progress.postsOnPage ?? 0)} posts on the page, {num(progress.newCount ?? 0)} new
                      to the campaign
                      {progress.freshCount !== undefined && progress.freshCount !== progress.newCount
                        ? ` (${num(progress.freshCount)} posted inside the campaign window)`
                        : ""}
                      , {num(progress.cumulative ?? 0)} collected all-time.
                    </Detail>
                    {fmtSeconds(progress.durationSeconds) ? (
                      <Detail label="Duration">{fmtSeconds(progress.durationSeconds)}</Detail>
                    ) : null}
                    {ended ? <Detail label="Ended because">{ended}</Detail> : null}
                  </>
                ) : null}
                {progress.state === "error" && progress.message ? (
                  <Detail label="Error">{progress.message}</Detail>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
