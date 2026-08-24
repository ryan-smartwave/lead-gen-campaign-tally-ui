import path from "node:path";
import { pathToFileURL } from "node:url";
import { scraperDir } from "./localStore";
import { closeRun, createDbRunStore, heartbeat } from "./dbRunStore";
import { appendLedger, closeLedger } from "./runLedger";
import { isDbConfigured } from "./db";
import { campaignDay } from "./format";
import type { Platform, RunEvent, Target } from "./types";

/**
 * Owns the single in-flight run, and drives the scraper as a library.
 *
 * A run lasts 30–60 minutes and therefore outlives the HTTP request that starts
 * it. State lives on globalThis so Next's hot reload can't orphan a run that is
 * holding the only Chrome session, and events are buffered so a client that
 * reloads (or a phone that locked its screen) can replay and catch up.
 *
 * Results go straight to Postgres: the scraper is handed a database-backed store
 * and writes no files. The only thing left on disk is the lock (which guards
 * Chrome) and a one-line-per-run ledger behind the once-a-day guard.
 */

interface ManagerState {
  events: RunEvent[];
  runId: string | null;
  business: string | null;
  startedAt: string | null;
  finished: boolean;
  controller: AbortController | null;
  listeners: Set<(e: RunEvent) => void>;
  lastError: string | null;
}

const EVENT_CAP = 2000; // a run emits well under 100; this is a runaway guard

function create(): ManagerState {
  return {
    events: [],
    runId: null,
    business: null,
    startedAt: null,
    finished: true,
    controller: null,
    listeners: new Set(),
    lastError: null,
  };
}

const g = globalThis as unknown as { __campaignRunManager?: ManagerState };
const state: ManagerState = (g.__campaignRunManager ??= create());

export function isRunning(): boolean {
  return !state.finished;
}

export function activeBusiness(): string | null {
  return state.business;
}

export function snapshot() {
  return {
    active: !state.finished,
    runId: state.runId,
    business: state.business,
    startedAt: state.startedAt,
    firstSeq: state.events[0]?.seq ?? 0,
    lastSeq: state.events.at(-1)?.seq ?? 0,
    events: state.events,
    lastError: state.lastError,
  };
}

export function subscribe(fn: (e: RunEvent) => void): () => void {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

export function stop(): boolean {
  if (state.finished || !state.controller) return false;
  state.controller.abort();
  return true;
}

/**
 * Forgets a finished run's event log so its panel stops being shown. Only ever
 * clears a run that has ended; the results live in the database, so nothing is
 * lost.
 */
export function clearFinished(): boolean {
  if (!state.finished) return false;
  state.events = [];
  state.runId = null;
  state.startedAt = null;
  state.business = null;
  state.lastError = null;
  return true;
}

function push(event: RunEvent) {
  state.events.push(event);
  if (state.events.length > EVENT_CAP) state.events.splice(0, state.events.length - EVENT_CAP);
  for (const fn of state.listeners) {
    try {
      fn(event);
    } catch {
      /* a broken listener must never affect the run */
    }
  }
}

/**
 * Loads the scraper as a library.
 *
 * The path is computed at runtime so the bundler never resolves it, which keeps
 * a scraper-less hosted deployment buildable. The cache-busting query is there
 * because Node caches ES modules for the life of the process: without it, an
 * edit to the scraper is invisible until the server restarts — which is exactly
 * the trap that made a fixed bug look unfixed.
 */
async function loadScraper() {
  const dir = scraperDir();
  const fs = await import("node:fs");
  const stamp = (file: string) => {
    try {
      return String(fs.statSync(file).mtimeMs);
    } catch {
      return "0";
    }
  };
  const runFile = path.join(dir, "src", "run.js");
  const configFile = path.join(dir, "src", "config.js");
  const runUrl = `${pathToFileURL(runFile).href}?v=${stamp(runFile)}`;
  const configUrl = `${pathToFileURL(configFile).href}?v=${stamp(configFile)}`;
  const [runMod, configMod] = await Promise.all([
    import(/* webpackIgnore: true */ runUrl),
    import(/* webpackIgnore: true */ configUrl),
  ]);
  return { run: runMod.run, loadConfig: configMod.loadConfig };
}

export async function readScraperConfig(business?: string) {
  const { loadConfig } = await loadScraper();
  return loadConfig({ business });
}

export interface StartResult {
  runId: string;
  startedAt: string;
  business: string;
  targets: Target[];
  budgetMinutes: number;
  store: string;
}

export async function startRun(business?: string): Promise<StartResult> {
  if (!state.finished) {
    const err = new Error("a run is already in progress");
    (err as NodeJS.ErrnoException).code = "ALREADY_RUNNING";
    throw err;
  }
  if (!isDbConfigured()) {
    const err = new Error(
      "No DATABASE_URL is set. Web-driven runs write straight to the database, so one is required. Create a free Neon project, add its connection string to web/.env.local, then run npm run db:migrate.",
    );
    (err as NodeJS.ErrnoException).code = "DB_NOT_CONFIGURED";
    throw err;
  }

  const { run } = await loadScraper();
  const config = await readScraperConfig(business);

  const runId = new Date().toISOString();
  const businessSlug: string = config.business;
  const targets: Target[] = (config.hashtags as { platform: Platform; value: string }[]).map(
    (h) => ({ platform: h.platform, hashtag: h.value }),
  );

  const store = createDbRunStore({
    business: businessSlug,
    campaign: config.campaign,
    runId,
    budgetMinutes: config.safety.maxRunMinutes,
    targets,
  });

  state.events = [];
  state.finished = false;
  state.controller = new AbortController();
  state.lastError = null;
  state.runId = runId;
  state.startedAt = runId;
  state.business = businessSlug;

  // Written before the first page is visited, so an interrupted run still
  // counts against the once-a-day guard.
  appendLedger({
    business: businessSlug,
    day: campaignDay(runId),
    runId,
    status: "running",
  });

  let started: (v: StartResult) => void;
  let failed: (e: unknown) => void;
  const ready = new Promise<StartResult>((res, rej) => {
    started = res;
    failed = rej;
  });

  const onEvent = (event: RunEvent) => {
    push(event);
    if (event.type === "run_started") {
      // The scraper mints its own run id; keep ours in step so the store,
      // the ledger and the events all reference the same row.
      state.startedAt = event.at;
      started({
        runId: event.runId,
        startedAt: event.at,
        business: businessSlug,
        targets: event.targets ?? targets,
        budgetMinutes: event.budgetMinutes,
        store: (event as { store?: string }).store ?? "database",
      });
    }
  };

  // A timer, not an event hook: the 3–7 minute gaps between hashtags would
  // otherwise look like a dead process to anything watching heartbeat_at.
  const beat = setInterval(() => {
    void heartbeat(runId).catch(() => {});
  }, 30_000);

  // Intentionally not awaited: the run outlives this request.
  void run({
    config,
    store,
    onEvent,
    signal: state.controller.signal,
    source: "web",
    runId,
  })
    .then(async (result: { status: string; abortReason: string | null }) => {
      await closeRun(runId, result.status, result.abortReason).catch(() => {});
      closeLedger(runId, result.status);
    })
    .catch(async (err: Error) => {
      state.lastError = err.message;
      await closeRun(runId, "aborted", err.message).catch(() => {});
      closeLedger(runId, "aborted");
      failed(err);
    })
    .finally(() => {
      state.finished = true;
      state.controller = null;
      clearInterval(beat);
    });

  return ready;
}
