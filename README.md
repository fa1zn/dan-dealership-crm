# Dan

Dan is a rep-facing sales tool for automotive dealership prospecting. It turns a raw
scrape of every franchise dealership in North America into a working book of business:
find dealers, pick them up, enrich them, and work them to a close.

It was built as the field-facing companion to Pam, an AI voice agent for dealerships.
Dan is the human rep's side of that motion: the system of record and the daily worklist.

## What it does

**Prospect** is discovery. It sits on top of ~34,700 real dealerships and lets a rep filter
by brand and tier and drill Country to State to City through a guided cascade with live
rooftop counts, then add a dealer to their worklist with one click. Adding a dealer picks it
up, runs the enrichment pass, and moves it into the Book.

**Book** is the CRM. Every dealer carries a status (new, working, engaged, won, lost), an
owner, and a full activity timeline. There is a sortable list view and a kanban board by
stage, CSV export, and a detail page for each rooftop with provenance on every field, a
"who to call and why" briefing, and live verification.

**Today** is the daily driver. It surfaces the one dealer worth calling right now, the rest
of the queue behind it, an honest month-to-date pipeline, and a live activity feed. Nothing
on it is fabricated; every number traces back to something the rep actually did.

## How the data comes together

The dealership records are built by a pipeline (ingest, normalize, dedupe, validate, enrich,
tier, export) that stitches OpenStreetMap and OEM dealer locators into one canonical set with
cross-source provenance and trust tiers. On top of that, three integrations enrich a dealer
on demand:

- **Google Places** verifies a rooftop live (rating, hours, open/closed, phone) with a 30-day cache.
- **HubSpot** overlays the rep's own pipeline (deal stage, owner, last activity) onto matched rooftops, read-only.
- **ZoomInfo** finds decision-maker contacts (name, title, email, phone) when a dealer is picked up, spending credits only on dealers the rep actually pursues.

Every enrichment degrades cleanly. If a key is missing or a provider is slow, the page still
renders and the feature just goes quiet.

## Stack

- Next.js 15 (App Router, React Server Components) and TypeScript
- SQLite via better-sqlite3, with Drizzle for typed queries
- Tailwind CSS
- A standalone TypeScript data pipeline (tsx)

## Design notes worth calling out

- **Provenance everywhere.** Hover any value on a dealer record and it tells you where it came
  from and when it was last checked. Inferred values are labeled as inferred, never dressed up
  as fetched fact.
- **Enriched vs Raw.** A global toggle flips the whole app between the cleaned, enriched view
  and the raw source data, so you can always see what was original and what Dan added.
- **Honest empty states.** Before a rep works anything, Today says so plainly instead of parading
  a fake goal or pipeline number.
- **Background enrichment.** Adding a dealer returns instantly and runs the ZoomInfo lookup in
  the background, so a slow third-party call never makes the rep wait.

## Running it

Requires Node 20 LTS.

```bash
npm install
cp .env.example .env   # fill in the API keys you have; all are optional
npm run dev            # http://localhost:3000
```

The app boots against an empty database and creates its schema on first run. To populate it,
run the pipeline (`npm run pipeline:all`) with the relevant source keys configured, or point it
at an existing `data/dealerships.sqlite`.

## Scope

This is a single-tenant local tool by design: one rep, one book, on one machine. Multi-rep
accounts, a shared hosted pipeline, and a server-side credential store are the natural next
step, and the schema is already keyed by rep to make that a drop-in later.
