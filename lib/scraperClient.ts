import type { Campaign, Platform, Target } from "./types";

/**
 * Client for the scraper service.
 *
 * The service runs on the operator's machine, owns the run lifecycle and writes
 * results to Postgres. This app talks to it over HTTP and never touches the
 * filesystem, so there is no path coupling between the two repositories — and a
 * run survives this app being restarted, rebuilt or closed, because the run
 * lives in the service's process rather than this one.
 */

export const SCRAPER_URL = process.env.SCRAPER_URL ?? "http://127.0.0.1:3900";

export class ScraperUnavailableError extends Error {
  constructor(cause: string) {
    super(
      `Could not reach the scraper service at ${SCRAPER_URL}. Start it with "npm run serve" in the scraper repo. (${cause})`,
    );
    this.name = "ScraperUnavailableError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 20_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SCRAPER_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as T & {
      error?: string;
      message?: string;
      hint?: string;
    };
    if (!res.ok) {
      const err = new Error(body.message ?? `scraper service returned ${res.status}`);
      (err as NodeJS.ErrnoException).code = body.error ?? String(res.status);
      Object.assign(err, { status: res.status, hint: body.hint });
      throw err;
    }
    return body;
  } catch (err) {
    // A connection failure is a different problem from a rejected request, and
    // the fix is different too, so it gets its own error type.
    if (err instanceof TypeError || (err as Error).name === "AbortError") {
      throw new ScraperUnavailableError((err as Error).message);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- health and capability ---------------- */

export interface ServiceHealth {
  ok: boolean;
  service: string;
  campaignDay: string;
  database: "configured" | "missing";
  running: boolean;
  campaigns: number;
  mcpEndpoint: string | null;
  configError: string | null;
}

export async function health(): Promise<ServiceHealth> {
  return request<ServiceHealth>("/health", { timeoutMs: 4000 });
}

/** True when the service is reachable — i.e. this device can run scrapes. */
export async function serviceReachable(): Promise<boolean> {
  try {
    await health();
    return true;
  } catch {
    return false;
  }
}

/* ---------------- campaigns ---------------- */

interface RawCampaign {
  slug: string;
  name: string;
  createdAt: string | null;
  hashtags: { platform: Platform; value: string }[];
  campaignStart?: string | null;
  campaignEnd?: string | null;
}

/** The service speaks the config file's `value`; the app uses `hashtag`. */
function toCampaign(raw: RawCampaign): Campaign {
  return {
    slug: raw.slug,
    name: raw.name,
    createdAt: raw.createdAt,
    hashtags: (raw.hashtags ?? []).map((h) => ({ platform: h.platform, hashtag: h.value })),
    campaignStart: raw.campaignStart ?? null,
    campaignEnd: raw.campaignEnd ?? null,
  };
}

function toServiceHashtags(hashtags: Target[]) {
  return hashtags.map((h) => ({ platform: h.platform, value: h.hashtag }));
}

export async function listBusinesses(): Promise<Campaign[]> {
  const body = await request<{ campaigns: RawCampaign[] }>("/campaigns");
  return (body.campaigns ?? []).map(toCampaign);
}

export async function createBusiness(
  name: string,
  hashtags: Target[] = [],
  dates: { campaignStart?: string | null; campaignEnd?: string | null } = {},
): Promise<Campaign> {
  const body = await request<{ campaign: RawCampaign }>("/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name,
      hashtags: toServiceHashtags(hashtags),
      ...(dates.campaignStart !== undefined ? { campaignStart: dates.campaignStart } : {}),
      ...(dates.campaignEnd !== undefined ? { campaignEnd: dates.campaignEnd } : {}),
    }),
  });
  return toCampaign(body.campaign);
}

export async function updateBusiness(
  slug: string,
  patch: {
    name?: string;
    hashtags?: Target[];
    campaignStart?: string | null;
    campaignEnd?: string | null;
  },
): Promise<Campaign> {
  const body = await request<{ campaign: RawCampaign }>(`/campaigns/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.hashtags !== undefined ? { hashtags: toServiceHashtags(patch.hashtags) } : {}),
      ...(patch.campaignStart !== undefined ? { campaignStart: patch.campaignStart } : {}),
      ...(patch.campaignEnd !== undefined ? { campaignEnd: patch.campaignEnd } : {}),
    }),
  });
  return toCampaign(body.campaign);
}

export async function deleteBusiness(slug: string): Promise<void> {
  await request(`/campaigns/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

/* ---------------- preflight and runs ---------------- */

export type BlockedBy =
  | "no_campaign"
  | "no_hashtags"
  | "db_not_configured"
  | "already_running"
  | "mcp_unreachable"
  | "already_ran_today"
  | "config_invalid"
  | null;

export interface ServicePreflight {
  canRun: boolean;
  blockedBy: BlockedBy;
  overridable: boolean;
  campaignDay: string;
  campaign: { slug: string; name: string; hashtags: { platform: Platform; value: string }[] } | null;
  campaigns: { slug: string; name: string; hashtags: number }[];
  checks: Record<string, { state: string; detail: string; hint?: string | null }>;
  safety?: Record<string, number | number[] | boolean>;
}

export async function preflight(campaign?: string): Promise<ServicePreflight> {
  const qs = campaign ? `?campaign=${encodeURIComponent(campaign)}` : "";
  return request<ServicePreflight>(`/preflight${qs}`, { timeoutMs: 8000 });
}

export interface StartedRun {
  runId: string;
  startedAt: string;
  campaign: string;
  campaignName: string;
  targets: Target[];
  budgetMinutes: number;
  store: string;
}

export async function startRun(campaign: string, force = false): Promise<StartedRun> {
  return request<StartedRun>("/runs", {
    method: "POST",
    body: JSON.stringify({ campaign, force }),
    timeoutMs: 60_000, // opening the run row can wake a sleeping database
  });
}

export async function stopRun(): Promise<{ stopping?: boolean; cleared?: boolean }> {
  return request("/runs/active", { method: "DELETE" });
}

export interface RunSnapshot {
  active: boolean;
  runId: string | null;
  campaign: string | null;
  startedAt: string | null;
  firstSeq: number;
  lastSeq: number;
  events: unknown[];
  lastError: string | null;
}

export async function runSnapshot(): Promise<RunSnapshot> {
  return request<RunSnapshot>("/runs/active", { timeoutMs: 8000 });
}

/** The service's SSE endpoint, for the browser to subscribe to directly. */
export function eventsUrl(sinceSeq = 0): string {
  return `${SCRAPER_URL}/runs/events?sinceSeq=${sinceSeq}`;
}
