# QA — how Depot Finder is checked

Owner: c8. The contract is `PLAN.md`. Numbers come from a QA worktree pinned to a commit
(`rig qa --ref <sha> --port 6009`), never from a working tree.

## Run it

```
npm install                 # @playwright/test only; browsers live in ~/Library/Caches/ms-playwright
npm test                    # unit suites that exist (node --test) + every Playwright spec
npm run test:e2e            # every *.spec.js under app/tests, chromium + webkit, 390x844 + 1280x800
npm run test:qa             # only c8's specs
npm run qa:live             # API=<worker url> [ADMIN_PIN=...] round-trip against the real Worker
```

`playwright.config.js` starts `app/tests/qa/serve.mjs` on **6009** serving the **repo root**, so
`/app/` reaches `../data/depots.json` exactly as the static layout does. Set `QA_PORT` to move it.
Four projects: `chromium-phone`, `webkit-phone` (390x844 @2x, touch), `chromium-desktop`,
`webkit-desktop` (1280x800). Clock is pinned to `America/St_Johns`.

Screenshots and the HTML report land in `app/tests/qa/shots/` (generated subfolders are ignored).

## What each check measures, and what makes it red

| Check | Green means | Red when |
|---|---|---|
| `journey.spec.js` | Against `?mock=1`: ≥1 `.leaflet-tile-loaded`; "Takes paint" tap changes the row count to a smaller non-zero number; tapping a row shows a heading with that row's name, the fixed beverage sentence and "Last checked"; tapping "Source" reveals an http link and a quoted line; the correction form submits and a thank-you appears (the POST body, if it goes through fetch, has string `depot_id`/`field`). | Tiles never finish loading, filter is a no-op, tap lands on a covering element, source has no link/quote, form never confirms. |
| `plain-english.spec.js` | Visible text (`innerText`) of the list, filters and every mock depot page contains no developer word (`null`, `undefined`, `NaN`, `JSON`, `API`, `TODO`, snake_case identifiers, `America/St_Johns`…), no "all depots accept / every depot takes …" other than *Every Green Depot takes beverage containers.*, and every depot-page line with "Unknown" also says "call to confirm". | Any one of those strings appears. |
| `real-data.spec.js` | Skips unless `data/depots.json` exists. APCO Recycling's page shows a `tel:` link and the text 709-489-1949; Mon–Sat lines carry 10:00, 12:30, 1:00/13:00 and 4:30/16:30, Sun says closed. Every depot page has at least as many "Source" disclosures as it has Yes/No verdicts, and "call to confirm" whenever it has an Unknown. | Wrong phone, missing lunch closure, a decided verdict without a Source. |
| `tests/live-roundtrip.mjs` | `/health` ok; `/stats` integer; valid `POST /correction` 201 with id; unknown field 400; bad shape 400; missing and wrong PIN 401; with `ADMIN_PIN` the new row is listed; stats moved by exactly 1 and `by_field.other` ≥ 1. | Any status differs. |

## Real input and hit-testing

Every tap goes through `tap()` in `app/tests/qa/helpers.js`: scroll into view, take the centre of
the box, ask `document.elementFromPoint` what is there, fail if it is not the target or inside it,
then `page.mouse.click`. No `dispatchEvent`, no programmatic `.click()`. This catches a map pane or a
sticky bar covering a chip, which rectangle measurements never do.

## Negative controls (recorded runs)

- **Sweep.** `app/tests/qa/fixtures/planted.html` carries "Every depot takes paint.", "Phone: null",
  "Field: refillable_beer" and "Paper and cardboard: Unknown". The spec's *negative control* test
  asserts the sweep functions flag each and that `sweep()` throws; `fixtures/clean.html` must pass.
  `npm run qa:sweep:selftest` points the real screen sweep at the planted page: 3 red, 1 green.
- **Round-trip.** `npm run qa:live:selftest` runs the checks against an in-process fake Worker twice:
  correct (all green) and with the field whitelist dropped (the 400 check goes red, and the stats
  count check goes red with it because the bad row got stored). Exit 0 only if both halves behave.

## Test hooks c6 is asked to honour

The specs find things the way the contract words them: filter chips are buttons named exactly
"Takes paint", "Takes electronics", "Takes paper & cardboard", "Takes refillable beer",
"Takes Iceberg bottles", "Open now"; the depot page has a heading with the depot name, a "Source"
disclosure per Yes/No verdict (link + `blockquote`/`q`/`.quote`), a `form` with a `textarea` and a
submit button named Send/Submit/Suggest, and a thank-you/received message after submit. List rows
are found by `[data-depot-id]` (preferred), `[data-testid="depot-row"]`, `.depot-row` or `li.depot`;
the first line of a row's text is the depot name.

## Not measured here

Input-speed bugs under real wheel bursts (Playwright eases input; that is the Rig's CDP harness).
Rate-limit 429 is c7's local test, not the live round-trip (it would burn 60 rows in production).
