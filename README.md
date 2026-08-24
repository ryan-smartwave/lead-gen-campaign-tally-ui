# Campaign Tally — web app

Runs the campaign hashtag scraper from a browser for **any number of businesses**, shows what each one found, keeps a browsable history, and exports the lot as CSV.

> **Paired repository:** this app drives `lead-gen-campaign-tally-scraper`, a
> separate repo. Clone both side by side:
>
> ```
> lead-gen-campaign-tally/
>   lead-gen-campaign-tally-scraper/
>   lead-gen-campaign-tally-ui/
> ```
>
> That layout is the default; set `SCRAPER_DIR` if yours differs. The app imports
> the scraper at runtime by path, so it must be present with its dependencies
> installed for scrapes to run — the read-only viewing screens work without it.

## The shape of it

One Next.js app, deployed twice.

```
THIS MACHINE                                  ELSEWHERE
┌────────────────────────────────┐        ┌──────────────────┐
│ npm run dev                    │        │  Neon Postgres   │
│  dashboard · history · runs    │──sync─►│  (free tier)     │
│  settings · preflight · Run    │        └────────▲─────────┘
│         │                      │                 │ read-only
│         ▼ MCP :12306           │        ┌────────┴─────────┐
│  your signed-in Chrome         │        │ same app, hosted │
└────────────────────────────────┘        │ (phone, laptop)  │
                                          └──────────────────┘
```

The run button works only where the scraper can actually run — this machine, because that is where Chrome is signed in. The hosted copy has no Chrome to drive, so it says so plainly instead of offering a button that cannot work.

## The scraper is used as a library

The web app imports the scraper and hands it a **Postgres-backed store**, so a
web-driven run reads and writes only the database and leaves no scraped files on
disk. Deduplication comes from the same place the results do: a post insert that
hits an existing row returns nothing, so the count of rows actually inserted *is*
the number of new posts. There is no `seen.json` in this path to drift out of
step with the database.

Two things still live on disk, and neither is scraped data:

- **`data/run.lock`** — guards *Chrome*, not the data. Every business shares one
  browser session and one mcp-chrome bridge, so the lock is global to the
  installation: two businesses cannot scrape at once, and a terminal run cannot
  overlap a web run. It needs no database, which is why it isn't a database row.
- **`data/runs.log`** — one line per run (business, day, id, outcome). This is the
  memory behind the once-a-day guard. Without it, clearing the database would make
  the app forget it had already run today and silently re-open a second run, and
  blocks escalate when you retry through them.

The CLI is unchanged and still standalone: run it from a terminal and it uses the
file-backed store (`tally.csv`, `seen.json`, `posts/*.jsonl`) with no database at
all. **Don't mix the two for the same business** — each store keeps its own
deduplication memory, so a hashtag scraped through one path looks new to the
other. Pick the web app or the CLI per business and stay there.

## Where each thing is read from

| | Read from | Why |
|---|---|---|
| **Results** (charts, history, posts) | **the database**, whenever one is configured | What you see is always what the database holds. Clear it and the screens go empty — any other behaviour is just confusing. Local files are the fallback for an install with no database. |
| **Businesses and hashtags** | **local files** | This is what the scraper runs from and what Settings edits. Reading it from the database would mean clearing the database left you with no businesses to select and nothing to edit. |
| **"Already ran today?"** | **local files, always** | The files record what actually ran. Sourcing this guard from a mirror that can be cleared would silently re-open a second run on the same day — the exact escalation ANTIBAN.md exists to prevent. |

A run **writes to the database as it goes**: the run row when it starts, then each hashtag's tally and posts as that hashtag finishes, then the final status. So a run that aborts on a danger signal still leaves behind everything it collected. Those writes are queued off the scrape loop and can never fail it — a sleeping free-tier database must not pace a run holding the only Chrome session — and a full reconcile from the files runs when the scrape ends to backfill anything a write lost.

If the database is behind what this machine holds, the dashboard says so and offers **Sync to database** rather than just looking empty. Nothing is ever lost by clearing the database: the scraper's files remain the real record, and a sync restores everything.

Useful scripts: `node scripts/db-check.mjs` (read back what the database holds), `node scripts/db-clear.mjs` (empty the collected data, keeping businesses), `node scripts/verify-mirror.mjs` (prove the during-run write path against the real schema, in a rolled-back transaction).

## Businesses

Each business has its own hashtag list, its own history, and its own duplicate-tracking:

```
scraper/config.json              shared: mcpEndpoint + safety limits
scraper/businesses/<id>.json     per business: { name, hashtags }
scraper/data/<id>/               per business: tally.csv, seen.json, posts/, run.lock
```

Add and edit them under **Settings**, or by hand in those files — the web app writes the same files the CLI reads, so the two can never disagree. Pick which business you are looking at with the switcher in the header; the choice lives in the URL, so a shared link shows what the sender was looking at.

Because separate businesses have separate `seen.json` files, two businesses tracking the same hashtag each keep their own count, and neither can corrupt the other. They do share one Chrome session, so **only one business can be scraping at a time** — the lock enforces that. The once-a-day guard is per business.

**Safety limits are shared and are not editable from the app.** Hashtags are content; timing and volume limits are the anti-ban firewall. There is deliberately no route that can widen them.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Variable | Meaning |
|---|---|
| `SCRAPER_ENABLED=1` | This instance may run scrapes and edit businesses. **Do not set it on the hosted deployment** — its absence is what makes that copy read-only. |
| `DATABASE_URL` | Neon connection string. Optional; without it the app reads local files only. |
| `SCRAPER_DIR` | Path to the scraper checkout. Defaults to `../lead-gen-campaign-tally-scraper`. |

## Downloading data

Three CSV exports, from the dashboard or history page (or `GET /api/export?kind=…&business=…`):

| Export | One row per | Use for |
|---|---|---|
| **Daily tallies** | hashtag per scrape | the time series — charting growth per hashtag |
| **Scrape summary** | scrape | a log of runs, their status and coverage |
| **Posts with captions** | post | the raw material — captions, URLs, supplier @mentions |

Fields are quoted per RFC 4180 (captions contain commas, quotes and newlines) and the file carries a UTF-8 BOM so Excel keeps the emoji. Note this is stricter than the scraper's own `tally.csv`, which is written by plain concatenation and stays safe only because hashtags are validated on the way in.

## Adding the database (optional, for phone access)

1. Create a free project at [neon.com](https://neon.com) and copy the connection string.
2. Put it in `web/.env.local` as `DATABASE_URL=…`.
3. Apply the schema: `npm run db:migrate`
4. Click **Sync to database** on the dashboard after each scrape (or `POST /api/sync`).

Syncing is a pure upsert on natural keys, so repeating it is a no-op.

## Two numbers that look wrong but aren't

**"174 tallied" vs "159 distinct posts."** A post carrying three campaign hashtags is counted under each one, because dedup memory is per hashtag. Both numbers are shown, labelled differently, and never conflated. The headline is the distinct count.

**"Newly discovered" falls over time.** Posts are deduplicated for the life of the campaign, so daily discovery drops as coverage saturates. That is the design working; the cumulative curve is the signal.

## Facebook has no post links

Facebook hides post URLs from the automation layer, so Facebook posts are identified by a fingerprint of their author and text rather than a permalink, and their cards and CSV rows have no URL. The UI explains this where it appears rather than looking broken. Instagram posts link out normally.

## Anti-ban guarantees the web layer must not break

`ANTIBAN.md` in the scraper repo is binding here too:

- Only `POST /api/run` can reach Meta, and it refuses unless `SCRAPER_ENABLED=1`.
- `GET /api/preflight` probes the Chrome bridge with a **bare TCP connect**, never an MCP handshake. A handshake would occupy the single MCP session and create the stale-session failure it is meant to detect.
- The once-a-day guard is per business per campaign day (Asia/Manila), and an aborted day is treated as more serious, not less. Overriding is possible and deliberately awkward.
- Nothing polls Meta. The only recurring timer is the countdown in the browser.
- No route writes safety settings.

## Notes

- `npm run dev` must keep running for a scrape to continue; the run outlives the HTTP request but not the process. Avoid saving files mid-run — a dev-server restart kills the run and can leave a stale Chrome session needing the extension reloaded.
- Campaign days are Asia/Manila everywhere, defined once in `lib/format.ts`. The scraper's CSV uses UTC dates, which would put an early-morning run on the previous day; the app recomputes rather than trusting that column.
- `npm test` covers the CSV quoting rules. The scraper's own suite, in its repo, covers deduplication, the run loop, the lock and business config.
