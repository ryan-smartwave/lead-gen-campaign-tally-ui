import type { RunViewState, TargetProgressState } from "@/lib/types";
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

/**
 * The ordered target list with per-hashtag state. This is what makes a silent
 * run legible: even when nothing is happening, most rows are visibly finished
 * and exactly one is visibly queued.
 */
export function HashtagChecklist({ state }: { state: RunViewState }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {state.targets.map((target, index) => {
        const progress = state.results[targetKey(target)] ?? { state: "pending" as const };
        const isNext = state.waitingNext && targetKey(state.waitingNext) === targetKey(target);
        const active = progress.state === "active";
        return (
          <li
            // Index-qualified: the visit order is the identity here, and a
            // malformed target must not collide with its siblings.
            key={`${index}-${targetKey(target)}`}
            className={`list-row flex-nowrap gap-2 ${active ? "bg-accent-soft" : ""}`}
          >
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
                    ? progress.message
                    : progress.state === "never_visited"
                      ? "never visited"
                      : isNext
                        ? "up next"
                        : "queued"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
