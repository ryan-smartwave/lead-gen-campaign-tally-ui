import type { RunStatus, TallyStatus } from "@/lib/types";

/** Single source of truth for how every status looks and reads. */
interface Look {
  cls: string;
  glyph: string;
  text: string;
  title: string;
}

const MAP: Record<RunStatus | TallyStatus, Look> = {
  running: { cls: "", glyph: "●", text: "Running", title: "This run is still going" },
  stopped: {
    cls: "pill-warn",
    glyph: "■",
    text: "Stopped",
    title: "You stopped this run; it finished the hashtag it was on and kept what it collected",
  },
  complete: { cls: "pill-ok", glyph: "✓", text: "Complete", title: "Visited every hashtag it intended to" },
  aborted: {
    cls: "pill-danger",
    glyph: "!",
    text: "Aborted",
    title: "Stopped early on a danger signal — do not re-run the same day",
  },
  budget_stopped: {
    cls: "pill-warn",
    glyph: "◔",
    text: "Time budget",
    title: "Stopped at its time budget; remaining hashtags go first next run",
  },
  ok: { cls: "pill-ok", glyph: "✓", text: "OK", title: "Posts found" },
  empty: {
    cls: "pill-warn",
    glyph: "∅",
    text: "Empty",
    title: "0 posts — most likely a restricted hashtag on the platform's side, not a scrape failure",
  },
  error: { cls: "pill-danger", glyph: "×", text: "Error", title: "This hashtag failed; the run continued" },
};

export function StatusPill({ status }: { status: RunStatus | TallyStatus }) {
  // Falls back rather than throwing. This renders live status coming from the
  // scraper, and an unrecognised value should show as unknown, not crash the
  // page it sits on — which is exactly what an unmapped status did once.
  const s: Look =
    MAP[status] ?? {
      cls: "",
      glyph: "?",
      text: String(status ?? "unknown"),
      title: `Unrecognised status: ${String(status)}`,
    };
  // Icon plus text, never colour alone.
  return (
    <span className={`pill ${s.cls}`} title={s.title}>
      <span aria-hidden="true">{s.glyph}</span>
      {s.text}
    </span>
  );
}
