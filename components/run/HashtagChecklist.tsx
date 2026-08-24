import type { RunViewState, TargetProgressState } from "@/lib/types";
import { targetKey } from "@/lib/types";
import { num } from "@/lib/format";
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
  pending: "var(--ink-soft)",
  active: "var(--accent)",
  done: "var(--ok)",
  empty: "var(--warn)",
  error: "var(--danger)",
  never_visited: "var(--ink-soft)",
};

/**
 * The ordered target list with per-hashtag state. This is what makes a silent
 * run legible: even when nothing is happening, most rows are visibly finished
 * and exactly one is visibly queued.
 */
export function HashtagChecklist({ state }: { state: RunViewState }) {
  return (
    <ul className="stack" style={{ listStyle: "none", padding: 0, gap: "var(--space-2)" }}>
      {state.targets.map((target, index) => {
        const progress = state.results[targetKey(target)] ?? { state: "pending" as const };
        const isNext =
          state.waitingNext && targetKey(state.waitingNext) === targetKey(target);
        return (
          <li
            // Index-qualified: the visit order is the identity here, and a
            // malformed target must not collide with its siblings.
            key={`${index}-${targetKey(target)}`}
            className="row"
            style={{ gap: "var(--space-2)", flexWrap: "nowrap" }}
          >
            <span aria-hidden="true" style={{ color: COLOR[progress.state], width: 14 }}>
              {GLYPH[progress.state]}
            </span>
            <PlatformIcon platform={target.platform} />
            <span
              style={{
                fontWeight: progress.state === "active" ? 600 : 400,
                color: progress.state === "pending" ? "var(--ink-soft)" : "var(--ink)",
              }}
            >
              {target.hashtag ? `#${target.hashtag}` : <em>unnamed target</em>}
            </span>
            <span className="muted num" style={{ marginLeft: "auto", fontSize: 13 }}>
              {progress.state === "done" || progress.state === "empty"
                ? `${num(progress.postsOnPage ?? 0)} on page · +${num(progress.newCount ?? 0)} new · ${num(progress.cumulative ?? 0)} total`
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
