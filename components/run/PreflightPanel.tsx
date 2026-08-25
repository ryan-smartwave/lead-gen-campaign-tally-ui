import type { Check, Preflight } from "@/lib/types";
import { MCP_STALE_STEPS } from "@/lib/dangerCopy";

/**
 * Presentation of the preflight checks, split out of RunLauncher so the
 * launcher owns the run lifecycle and this owns how readiness looks.
 *
 * Green plumbing is noise: when nothing needs a human the checklist collapses
 * to one line, and it expands itself whenever any check does.
 */
export function PreflightPanel({ preflight }: { preflight: Preflight | null }) {
  const allQuiet =
    preflight != null &&
    preflight.checks.every((c) => c.status === "pass" || c.status === "not_checked");

  if (!allQuiet) {
    return (
      <div className="stack gap-1.5 rounded-[var(--radius-ctl)] bg-surface-2 p-3">
        {(preflight?.checks ?? []).map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
        {!preflight ? <span className="muted">Checking…</span> : null}
      </div>
    );
  }

  return (
    <details className="group rounded-[var(--radius-ctl)] bg-surface-2 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] select-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="grid h-[18px] w-[18px] place-items-center rounded-full bg-ok-bg text-[11px] font-bold text-ok"
        >
          ✓
        </span>
        <span className="font-semibold">All checks passed</span>
        <span className="muted">— ready to run</span>
        <span
          aria-hidden="true"
          className="muted ml-auto text-[11px] transition-transform group-open:rotate-90"
        >
          ▶
        </span>
      </summary>
      <div className="stack mt-2 gap-1.5">
        {preflight.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>
    </details>
  );
}

/** The step-by-step remedy for an unreachable Chrome bridge. */
export function BridgeRemedy() {
  return (
    <div className="stack gap-1.5 rounded-[var(--radius-ctl)] border-l-[3px] border-warn bg-warn-bg p-3">
      <strong className="text-[13px]">Start the Chrome bridge</strong>
      <ol className="stack m-0 gap-1 pl-[1.2em] text-[13px]">
        {MCP_STALE_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

const CHECK_LOOK = {
  pass: { glyph: "✓", cls: "text-ok bg-ok-bg" },
  fail: { glyph: "×", cls: "text-danger bg-danger-bg" },
  warn: { glyph: "!", cls: "text-warn bg-warn-bg" },
  not_checked: { glyph: "·", cls: "text-ink-soft bg-surface" },
  stale: { glyph: "◔", cls: "text-warn bg-warn-bg" },
} as const;

function CheckRow({ check }: { check: Check }) {
  const look = CHECK_LOOK[check.status];
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className={`mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${look.cls}`}
      >
        {look.glyph}
      </span>
      <span className="text-[13px]">
        <span className="font-semibold">{check.label}</span>{" "}
        <span className="muted">{check.detail}</span>
      </span>
    </div>
  );
}
