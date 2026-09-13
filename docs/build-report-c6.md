# Build report — c6 · Customer app

Branch `rig/c6`. Slice: `app/**`. Date: 2026-09-13.

## What I built (all under `app/`)

| File | What it is |
|---|---|
| `index.html`, `styles.css` | Phone-first static page: header, six filter chips, Leaflet map (1.9.4 from cdnjs, OpenStreetMap tiles, attribution kept, SRI hashes computed from the CDN files), depot list, depot page, footer. White ground, ink `#101418`, green `#1f7a3a`, muted `#5b6670`, rule `#d9dee3`, amber for Unknown. System fonts. No emoji. Two-pane at ≥900px. |
| `app.js` | Loads `../data/depots.json` then `data/depots.json` (or the mock with `?mock=1`). List sorted by town, or by distance after "Sort by distance" (asks for location only on tap; uses it silently if already granted). Hash routes `#/` and `#/depot/<id>`. Depot page: address, Directions (Google Maps by lat/lng), `tel:` link, hours table with today highlighted, five verdict sentences with a Source disclosure (quote, link, fetched date), the standing beverage line, "Suggest a correction" form, "Last checked". |
| `hours.js` | Open-now in the depot's own zone. `tz` per row, else `hours.note` containing "Atlantic" → `America/Goose_Bay`, else `America/St_Johns`. Split lunch, past-midnight ranges, `00:00-24:00`, unknown days, "Opens Tue 10:00" style next-change text, "closes soon" inside 60 min. |
| `hours.test.mjs` | 11 `node --test` cases: NDT conversion, split lunch, closes-soon, opens tomorrow, skip closed Sunday, Labrador same-instant-different-verdict, midnight crossing, all-day, unknown never guessed, parser. |
| `map.js` | Leaflet wrapper; 28px pin tap targets, popup links to the depot page. |
| `data.mock.js` | Five synthetic depots (names say "Sample"). Every variable has a yes, a no and an unknown somewhere; hours are generated relative to the current clock so the list always shows open / closes soon / closed / hours-unknown. One Labrador row on Atlantic time with a split lunch. |
| `api.js`, `api.mock.js`, `config.js` | Worker client per `docs/API.md` and an in-memory mock that records posts on `window.__mockCorrections`. `config.js` holds the API base: localhost → `http://localhost:6002`; otherwise `window.DEPOT_FINDER_API` or a placeholder host **Main must set** (see "Needed from others"). |
| `tests/` | Own Playwright suite (`app.spec.js`, `playwright.config.js`, `serve.mjs`, `package.json`, gitignored `node_modules`). Chromium + WebKit, iPhone 14 (390x844), clock pinned to `America/St_Johns`. Screenshots in `tests/shots/`. |

## What I verified, and what would have made it red

Run: `cd app/tests && npm install && npx playwright test` (also `DESKTOP=1` for 1280x800, and `BASE_URL=` to point at any server). Unit: `node --test app/hours.test.mjs`.

- **hours.js — DONE.** 11/11 green. Negative control: set the closes-soon threshold to 5 minutes → 2 tests red; restored → green.
- **Map renders tiles — DONE.** Counts `.leaflet-tile-loaded` > 3 and the attribution text; red if tiles never load (which the wrong SRI hashes I first wrote from memory would have caused — I computed the real ones with openssl).
- **Filter chips change the count (real taps) — DONE.** Expected counts come from the mock rows; "Open now" must agree with the pills on screen. Red on a no-op filter or a covered chip.
- **Row tap opens the depot page; every verdict sentence and `data-verdict` match the mock for all five depots; Unknown says "call to confirm" and has no Source; Yes/No has exactly one Source — DONE.**
- **Source disclosure reveals the quote and link; Directions and tel: hrefs exact; 7 hours rows, one highlighted today — DONE.**
- **Correction form posts to the mock — DONE.** Typed with the keyboard, tapped Send; asserts the thank-you text and the exact recorded body (`depot_id`, `field`, `proposed`, `note`, `contact`).
- **Hit-test every tappable thing — DONE.** Chips, sort button, zoom controls, pins, rows, brand, back, action buttons, Source summaries, all form controls: `elementFromPoint` at the centre must be the element, and the smaller side must be ≥24px. This caught two real defects: 18px map pins (now 28px) and the WebKit native `<select>` rendering 22px tall (now styled, 44px).
- **Pin popup links to the depot page — DONE.**
- **Negative control for the suite — DONE.** Flipped Sample Depot One's paint verdict to No in the app's mock while the spec kept a frozen copy: 2 tests red ("2 of 5" became "1 of 5"; verdict `yes` became `no`). Restored → 18/18 green on chromium + webkit, phone and desktop, and under both server layouts (app as root, and repo root with `/app/`).

Final run: 18 passed (chromium 9, webkit 9).

## Hooks for c8's QA harness (from Onyx's message, `docs/QA.md` on main) — DONE
`data-depot-id` and `data-testid="depot-row"` on every list row, name is the first line of row text; chips are buttons with the exact contract names; depot heading is the depot name; "Source" summary with `blockquote` + http link per Yes/No; `form` with `textarea`, submit named "Send correction", thank-you text "Thank you. Your correction was received"; every line containing Unknown also says "call to confirm" (pills, hours cells, verdicts). No `null`/`undefined`/snake_case/zone ids in visible text (Labrador note shows "Goose Bay").

## Left undone / decisions to flag
- **Port.** The contract gives c6 port 6001, but 6001 was already held by another project's server (`python -m http.server 6001 -d app` from a Rota worktree). My suite uses **6021**. Nothing in my slice depends on 6001.
- **Real data not exercised.** `data/depots.json` did not exist in my tree; the loader's two paths are tested only by the mock switch and by manual 404 fallback. c8's `real-data.spec.js` covers it once c5 lands.
- **Geolocation sort** is not covered by the suite (needs a granted permission fixture); the distance math and re-sort are exercised manually only.
- **Playwright install lives in `app/tests/`** (own `package.json`, pinned 1.63.0) because root `package.json` is c8's. c8's runner will also pick up `app/tests/app.spec.js`; it is written to work under their repo-root server too.

## Needed from other slices
- **Main:** set the deployed Worker URL. Either edit `app/config.js` (the `https://depot-finder.workers.dev` placeholder) or define `window.DEPOT_FINDER_API` before `app.js` loads. Also confirm the static-assets Worker serves `data/depots.json` beside `index.html` (second load path) or the repo layout (first path).
- **c7:** nothing beyond `docs/API.md`; the app sends only `depot_id`, `field`, `proposed`, and `note`/`contact` when filled.
- **c5:** rows may carry an optional `tz` (IANA) for Labrador depots; otherwise put "Atlantic" in `hours.note` and the app will use Goose Bay time.
