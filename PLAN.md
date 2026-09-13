# Depot Finder — build contract

One plan file. It is the contract, at the repo root, and every agent reads the same copy.

## The brief (Alexander, 2026-09-13)
**Depot Finder: every Green Depot in Newfoundland and Labrador on one map, with hours, phone, "open now", and exactly what each one accepts.** Every Green Depot takes MMSB beverage containers; that is a given. The variables, and the whole point of the app, are the things depots differ on:

1. **Local brewers' refillable beer bottles** (Molson/Labatt NL refillables)
2. **Quidi Vidi Iceberg blue bottles**
3. **Paper and cardboard**
4. **Paint** (Product Care program)
5. **Electronics** (EPRA / Recycle My Electronics)

Each depot gets a verdict per variable: **Yes / No / Unknown**, and every Yes or No carries a citation (URL, date fetched, the quoted line). If we could not find it in a source, it is **Unknown, call to confirm**, never a guess. This is also a sales list for APCO Software Tools (every depot is a prospect), and a portfolio showpiece: a cited research pipeline, an honest data model, a fast phone-first map.

**The honesty rule.** No invented depots, hours, phone numbers or acceptance claims. A row with no source for a field shows Unknown. The app never says "all depots accept X" beyond beverage containers. APCO Recycling (Grand Falls-Windsor) is Alexander's own depot; its row is ground truth: Mon–Sat 10:00–4:30, closed 12:30–1:00, phone 709-489-1949, takes refillables and Iceberg bottles at 5¢.

**Design.** White ground, ink `#101418`, depot green `#1f7a3a` accent, muted `#5b6670`, rule `#d9dee3`, amber for Unknown. System fonts. Phone-first at 390, also good at 1280. Map via Leaflet 1.9.4 from cdnjs with OpenStreetMap tiles (attribution kept). No emoji icons. Plain English.

**Stack.** Static app in `app/` (plain HTML/JS/CSS, no build) reading `data/depots.json`. Worker + D1 in `worker/` only for "Suggest a correction" (`POST /correction`) and `GET /stats`; D1 quota is full (10 DBs) so it uses the bottle-count database (id `e32262b9-ade2-4963-8441-ed1709d6b25d`, binding `DB`, its own tables prefixed `df_`). Contract `docs/API.md` and `docs/DATA.md` (schema below). Ports: c7 `wrangler dev --port 6002`; c6 static 6001; QA 6009. Main deploys.

**Data schema (`data/depots.json`, one row per depot):**
```
{ id, name, town, region, address, lat, lng, phone, website, facebook,
  hours: { mon..sun: "10:00-16:30" | "closed" | null, note },
  accepts: {
    beverage: { verdict: "yes", note },
    refillable_beer: { verdict: "yes|no|unknown", cite: {url, fetched, quote} | null },
    iceberg_bottles: { ... }, paper_cardboard: { ... }, paint: { ... }, electronics: { ... }
  },
  sources: [ {url, fetched, what} ], last_checked, confidence: "verified|partial|listing-only" }
```

## Rules
- You own the files under your id and nothing else; `rig guard` enforces it. Commit only your own paths. Verify → commit → report (`docs/build-report-<id>.md`).
- Never grade the shared tree. No visible Chrome; `pwshot` for screenshots into your own slice's `shots/` folder. Chromium + WebKit.
- A check that cannot fail measured nothing: say what would make it red, make it red once, record it.
- No invented anything. Unknown is a valid, expected answer. Cite or mark unknown.

## Agents

### c5 — Depot research (the heart of the build)
Owns:
- data/**
- docs/DATA.md
- docs/sources/**

Report: docs/build-report-c5.md

Task: build `data/depots.json` for EVERY Green Depot in NL. Step 1: the master list from MMSB's own depot locator (mmsb.nl.ca, "Find a Green Depot" / locations page; fetch and save the raw HTML/JSON under `docs/sources/` with date). Aim for the full list (expect roughly 45–60 depots); record the count you found and where. Step 2: per depot, DEEP research: the depot's own website, Facebook page, Google listing text, town pages, news articles, MMSB pages. Step 3: the program locators for the two regulated streams: Product Care Recycling's NL paint drop-off locator (productcare.org) for `paint`, and EPRA NL / recyclemyelectronics.ca/nl locator for `electronics`; a depot on those lists is a cited Yes, a depot absent from them is `unknown` (absence is not a No) unless the depot itself says no. Step 4: refillable beer and Iceberg blue bottles: only a cited Yes/No from the depot itself, MMSB, or the brewer (Quidi Vidi / Molson-Labatt NL return info); otherwise unknown. Step 5: paper/cardboard: cited from depot or town pages; otherwise unknown. Save every source page you rely on as text under `docs/sources/<depot-id>/` with the URL and date at the top, so the citations survive link rot. Use WebSearch/WebFetch; be polite (1 request/second per host). Write `docs/DATA.md` (schema, verdict rules, how confidence is assigned, how to add or correct a depot), `data/validate.mjs` (node --test: schema, unique ids, lat/lng inside NL's bounding box, every yes/no has a cite with url+quote, APCO row matches the brief exactly, at least 40 depots, exit 1 on failure) and `data/summary.mjs` printing counts per verdict per variable. Negative control: plant a Yes with no cite and show validate go red; restore. In the report: total depots, how many fully verified vs listing-only, the variables with the most unknowns, and any source that looked wrong.

### c6 — Customer app
Owns:
- app/**

Report: docs/build-report-c6.md

Task: `app/index.html` + `app.js` + `styles.css` + `map.js` + `hours.js` + `data.mock.js` (`?mock=1` with 5 SYNTHETIC depots covering every verdict and an "open now / closed / closes soon" spread; the real app loads `../data/depots.json` or `data/depots.json` as deployed). Screens: Map + list (default; list sorted by distance when the user allows location, else by town; each row: name, town, open-now pill green/red/grey with "Opens Tue 10:00" style next-change text, and five small verdict chips for the five variables: Yes green, No ink, Unknown amber); Filters (chips: "Takes paint", "Takes electronics", "Takes paper & cardboard", "Takes refillable beer", "Takes Iceberg bottles", "Open now"); Depot page (name, address with a Directions link to Google Maps by lat/lng, phone as tel: link, hours table with today highlighted, the five verdicts as full sentences with a "Source" disclosure showing the quote and link, or "Unknown, call to confirm", the standing line "Every Green Depot takes beverage containers.", a "Suggest a correction" form posting to the Worker (`api.js`, `api.mock.js`), "Last checked" date). `hours.js` computes open-now in America/St_Johns with `node --test` cases including Labrador rows (Atlantic time: hours.note carries the zone; support `tz` per row), split lunch closures, and midnight. Playwright `app/tests/` (chromium + webkit, 390x844) against the mock with REAL input: filter chips change the list count, tapping a row opens the depot page, verdict sentences match the mock's verdicts, Unknown wording present, correction form posts to the mock, hit-test every tappable thing, the map renders tiles (count `.leaflet-tile` loaded). Negative control: flip one mock verdict and show the assertion go red; restore. Screenshots to `app/tests/shots/`.

### c7 — Corrections Worker
Owns:
- worker/**

Report: docs/build-report-c7.md

Task: implement `docs/API.md`: `POST /correction` (`{depot_id, field, proposed, note, contact?}`, 400 on bad shape, 60/h/IP rate guard, stores to `df_corrections(id, depot_id, field, proposed, note, contact, created, ip_hash)`), `GET /corrections?pin=` (Bearer `ADMIN_PIN` secret; `.dev.vars` local), `GET /stats` (counts), `GET /health`. `worker/wrangler.toml` name `depot-finder`, D1 binding `DB` on the bottle-count database id above, `migrations/0001_df.sql`. CORS for the app origin and localhost. Tests `worker/tests/api.test.mjs` against `wrangler dev --port 6002` (`npx wrangler`): health, valid correction stored, bad shape 400, wrong PIN 401, rate guard 429, stats. Negative control: drop the field-name whitelist and show the 400 test go red; restore.

### c8 — QA harness, whole-suite runner, live round-trip
Owns:
- app/tests/qa/**
- playwright.config.js
- package.json
- docs/QA.md
- tests/live-roundtrip.mjs

Report: docs/build-report-c8.md

Task: root `package.json` + `playwright.config.js` running every spec on chromium + webkit at 390x844 and 1280x800, static server on 6009 serving the repo root; `app/tests/qa/journey.spec.js`: map loads, filter, open a depot, read a source, submit a correction, all real input and hit-tested; `app/tests/qa/plain-english.spec.js`: banned developer words on every screen, and "all depots accept" / "every depot takes" must NOT appear except the fixed beverage sentence, and every Unknown verdict shows "call to confirm"; `app/tests/qa/real-data.spec.js` (runs when `data/depots.json` exists): the APCO row renders with the phone 709-489-1949 and the exact hours, and every depot page shows a Source for every Yes/No. `tests/live-roundtrip.mjs` against the real Worker (`API=`): health, correction round-trip, 400, 401, stats. Negative control: plant "every depot takes paint" on a throwaway page and show the sweep go red; restore. `docs/QA.md`.

## Main (Onyx, not a slice)
Owns PLAN.md, docs/API.md. Creates tables, sets `ADMIN_PIN`, deploys Worker `depot-finder` + static-assets Worker `depot-finder-app`, runs c5's validate, c8's round-trip against the real thing, README, PDF summary, private repo until Alexander's go.
