# Campaign Tally — web app

Runs the campaign hashtag scraper from a browser for **any number of businesses**,
shows what each one found, keeps a browsable history, and exports it all as CSV.

> **Paired repository:** this app drives
> [`lead-gen-campaign-tally-scraper`](../lead-gen-campaign-tally-scraper), which runs
> as a local HTTP service. There is no path or filesystem coupling — point
> `SCRAPER_URL` at it (default `http://127.0.0.1:3900`) and start it with
> `npm run serve` in that repo. Because the run lives in the service's process,
> restarting or rebuilding this app cannot kill a scrape in flight.

## The shape of it

```
THIS MACHINE                                        ELSEWHERE
┌──────────────────────────────────────┐        ┌──────────────────┐
│ this app  (npm run dev, :3000)       │        │    Postgres      │
│   dashboard · history · settings      │◄──read─│                  │
│            │ HTTP                     │        └────────▲─────────┘
│            ▼                          │                 │ writes
│ scraper service (:3900)               │─────────────────┘
│            │ MCP :12306               │        ┌──────────────────┐
│            ▼                          │        │ same app, hosted │
│ your signed-in Chrome                 │        │ (phone, laptop)  │
└──────────────────────────────────────┘        └──────────────────┘
```

The same app deployed elsewhere is read-only automatically: it cannot reach a
service on your laptop, so it says so rather than offering a button that cannot
work.

## How the two halves divide

This app **reads**; the scraper service **writes**.

| | Comes from | Why |
|---|---|---|
| **Results** (charts, history, posts) | Postgres | The service writes results as a run goes, so what you see is what the database holds. Clear it and the screens go empty — any other behaviour is just confusing. |
| **Businesses and hashtags** | Postgres | The service owns the config files and mirrors them into the database on every change, so this app never needs filesystem access and the hosted copy works identically. |
| **Can this device scrape?** | Whether the service answers | Observed, not configured. The service only exists where Chrome is signed in, so reachability *is* the capability — there is no flag to set wrongly. |
| **Starting or stopping runs, editing businesses** | The service, over HTTP | One writer, one source of truth. |

The browser only ever talks to this app's own origin: run control and the event
stream are proxied, so the service's address stays a server-side detail and there
is no cross-origin setup.

Database schema and the `db:*` scripts live in the scraper repo, which owns them
by virtue of being the writer.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Start the scraper service too, or the run button
will correctly report that this device cannot scrape.

| Variable | Meaning |
|---|---|
| `SCRAPER_URL` | The scraper service. Defaults to `http://127.0.0.1:3900`. Reachability is what makes this instance able to run scrapes, so a hosted deployment can leave it as-is. |
| `DATABASE_URL` | Postgres connection string, the same database the service writes to. This app only reads from it. Without it every data screen shows a setup notice. |

## Screens

- **Dashboard** — latest scrape status, preflight and the run button, KPI tiles, a
  per-hashtag table with sparklines, and (from the second scrape onward) the
  cumulative and daily-discovery charts.
- **History** (`/runs`) — every scrape, with status, coverage and what it found.
- **Run detail** (`/runs/<id>`) — that scrape's per-hashtag results, plus the posts
  it discovered grouped by hashtag.
- **Settings** — businesses and their hashtags. Safety limits are shown but not
  editable: hashtags are content, timing and volume limits are the anti-ban
  firewall, and no route can widen them.

Which business you are viewing lives in the URL (`?b=<id>`), so a shared link shows
the sender what they were looking at.

## Downloading data

Three CSV exports, from the dashboard or history page (or
`GET /api/export?kind=…&business=…`):

| Export | One row per | Use for |
|---|---|---|
| **Daily tallies** | hashtag per scrape | the time series — charting growth per hashtag |
| **Scrape summary** | scrape | a log of runs, their status and coverage |
| **Posts with captions** | post | the raw material — captions, URLs, supplier @mentions |

Fields are quoted per RFC 4180 (captions contain commas, quotes and newlines) and
the file carries a UTF-8 BOM so Excel keeps the emoji.

## Two numbers that look wrong but aren't

**"174 tallied" vs "159 distinct posts."** A post carrying three campaign hashtags
is counted under each one, because deduplication is per hashtag. Both numbers are
shown, labelled differently, and never conflated. The headline is the distinct
count.

**"Newly discovered" falls over time.** Posts are deduplicated for the life of the
campaign, so daily discovery drops as coverage saturates. That is the design
working; the cumulative curve is the signal.

**A hashtag's daily series has holes.** A run visits at most
`maxHashtagsPerRun` hashtags (12 by default); a business tracking more rotates
through the least recently scraped first, so every hashtag is covered but not
every day. Preflight shows a "Hashtag coverage" warning whenever the rotation
is active. The cumulative curve is unaffected.

**A run counts down before the first hashtag.** Every run starts with a
randomized delay (the scraper's `startJitterMs`, up to 10 minutes by default),
so daily runs can never fall into a fixed clock rhythm — a bot signature. The
countdown you see before the first hashtag is that rule working, not a hang.

## Facebook has no post links

Facebook hides post URLs from the automation layer, so Facebook posts are
identified by a fingerprint of their author and text rather than a permalink, and
their cards and CSV rows have no URL. The UI explains this where it appears rather
than looking broken. Instagram posts link out normally.

## Anti-ban guarantees this app must not break

`ANTIBAN.md` in the scraper repo is binding here too. Most of it is now enforced
in the service, which is the point — but this app must not undermine it:

- Nothing here can reach Instagram or Facebook. Only the service can, and it
  refuses when its own preflight says no.
- The once-a-day guard is the service's answer, surfaced verbatim. This app never
  computes its own version, so the warning shown and the rule enforced cannot
  disagree.
- Overriding that guard is possible and deliberately awkward — a second click,
  with the reason stated.
- Nothing polls Meta. The only recurring timer is the countdown in the browser.
- No route writes safety settings.

## Notes

- Campaign days are Asia/Manila, defined once in `lib/format.ts` (and once in the
  service). Postgres dates are cast to text on read so they cannot shift back a
  day.
- `npm test` covers the CSV quoting rules. The scraper's own suite, in its repo,
  covers deduplication, the run loop, the lock and business config.
