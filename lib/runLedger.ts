import fs from "node:fs";
import path from "node:path";
import { scraperDir } from "./localStore";

/**
 * A tiny append-only record of which business ran on which day.
 *
 * This is the only thing a database-backed run leaves on disk, and it holds no
 * scraped data — just a date, a run id and an outcome. It exists because the
 * once-a-day guard must not be forgettable: if the guard's only memory were the
 * database, clearing the database would silently re-open a second run on the
 * same day, and blocks escalate when you retry through them.
 *
 * Lives beside the lock file, because both are operational state rather than
 * results.
 */

export interface LedgerEntry {
  business: string;
  day: string;
  runId: string;
  status: string;
  at: string;
}

function ledgerPath(): string {
  return path.join(scraperDir(), "data", "runs.log");
}

export function appendLedger(entry: Omit<LedgerEntry, "at">): void {
  try {
    const file = ledgerPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`);
  } catch {
    /* the guard falls back to the database; never break a run over this */
  }
}

export function readLedger(): LedgerEntry[] {
  let text: string;
  try {
    text = fs.readFileSync(ledgerPath(), "utf8");
  } catch {
    return [];
  }
  const entries: LedgerEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      /* skip a malformed line */
    }
  }
  return entries;
}

/** Did this business run on this campaign day, according to the local ledger? */
export function ledgerHasRun(business: string, day: string): boolean {
  return readLedger().some((e) => e.business === business && e.day === day);
}

/** Updates the outcome of the most recent entry for a run. */
export function closeLedger(runId: string, status: string): void {
  const entries = readLedger();
  const target = entries.find((e) => e.runId === runId);
  if (!target) return;
  appendLedger({
    business: target.business,
    day: target.day,
    runId,
    status,
  });
}
