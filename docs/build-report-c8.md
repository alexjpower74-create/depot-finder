# Build report — c8 · QA harness, whole-suite runner, live round-trip

Branch `rig/c8`. Base `5f5ae49`. Written 2026-09-13. At the time of building, c5/c6/c7 had not
committed anything, so every app-dependent spec was written to the contract in `PLAN.md` and
skips with a stated reason until `app/index.html` / `data/depots.json` exist.

## Built — DONE
- `package.json` (root, ESM, `@playwright/test ^1.63`): `test`, `test:unit`, `test:e2e`, `test:qa`, `qa:live`, `qa:live:selftest`, `qa:sweep:selftest`, `serve`.
- `playwright.config.js`: every `*.spec.js` under `app/tests` (c6's specs included), chromium + webkit × 390x844 (touch, @2x) + 1280x800, `America/St_Johns` clock, webServer = `app/tests/qa/serve.mjs` on 6009 serving the repo root (`QA_PORT` overrides). Output under `app/tests/qa/shots/`.
- `app/tests/qa/serve.mjs`: zero-dependency static server, refuses paths outside root (verified: `/../../../etc/passwd` → 404, `/PLAN.md` → 200, unknown → 404).
- `app/tests/qa/unit-runner.mjs`: runs `data/validate.mjs`, c6's hours tests and `worker/tests/api.test.mjs` with `node --test` when they exist; prints SKIPPED with owner for each that does not, so a half-built tree never reads green by accident.
- `app/tests/qa/helpers.js`: `tap()` = hit-test with `elementFromPoint` then `page.mouse.click`; `expectMapTiles()` polls `.leaflet-tile-loaded`.
- `app/tests/qa/sweep.js` + `journey.spec.js`, `plain-english.spec.js`, `real-data.spec.js` as specified.
- `tests/live-roundtrip.mjs`: health, 201 round-trip (listed via `ADMIN_PIN` when given), unknown-field 400, bad-shape 400, missing/wrong PIN 401, stats delta = 1; `--selftest` mode with an in-process fake Worker.
- `docs/QA.md`.

## Verified, and how each could have failed
- **Whole suite on 4 projects @ 5f5ae49 + this work:** 4 passed (the negative-control test on each project), 28 skipped with reason "app/index.html not present yet". Nothing app-related is claimed green.
- **Sweep negative control (red run):** `npm run qa:sweep:selftest` → 3 failed / 1 passed. Failures named `developer word: "null"`, `"refillable_beer"`, `overclaim: "Every depot takes paint."`, and on the depot-page pass `Unknown without "call to confirm"`. The clean fixture passes. Planted page kept as a fixture; the real sweep only reads it under `QA_SWEEP_SELFTEST=1`.
- **Round-trip negative control:** `node tests/live-roundtrip.mjs --selftest` → correct fake: 10/10 PASS; whitelist-dropped fake: `POST /correction unknown field → 400` FAIL (got 201) and `stats count moved by 1` FAIL (0 → 2). Exit 0 because the harness caught the defect. First version of the self-test demanded exactly one red and reported VOID; the second red is a true consequence, so the check now requires the 400 failure to be present rather than alone.
- **Static server** smoke-tested with curl (above). Playwright's `webServer` health URL is `/PLAN.md`.

## Not done / needs another slice
- **Journey, plain-English (screens) and real-data specs are unexecuted** against a real app; they encode the contract's wording. Once c6 lands, run `rig qa --ref <sha> --port 6009 --run "npm run test:e2e"` and expect locator adjustments; the hooks I rely on are listed in `docs/QA.md` ("Test hooks c6 is asked to honour"). Ask c6 to add `data-depot-id` on list rows; everything else is derived from the plan's own wording.
- **Live round-trip** has not been run against the real Worker (nothing deployed yet). Main: `API=<url> ADMIN_PIN=<pin> npm run qa:live`. It writes one `field:"other"` row per run, note "safe to delete".
- **`.gitignore` is outside my slice** (Main owns it). Needed: `node_modules/`, `package-lock.json` (or commit it — Main's call). I ignored `test-results/` and `report/` with `app/tests/qa/shots/.gitignore`, which is inside my slice.
- **`.rig/config.json` `devCommand`** is null; suggest `npm run serve` so `rig qa` brings up the same server on 6009. Not my file.
- **Cross-review** requested: the sweep's snake_case rule (`/\b[a-z]+_[a-z]+/`) will flag any legitimate underscore in a depot name or address; if c5's data has one, the rule needs an allowlist, not deletion.
- `package-lock.json` exists locally but is not in my owned list; not committed.

## Update 2026-09-13 (after merge, main 7de16a5)
Onyx reported three failures against the real app; reproduced all three from this worktree at 7de16a5 and fixed in my slice only — DONE:
- journey: the beverage sentence exists on the map screen and the depot page; assert `.last()`.
- journey "every list row is hittable": rows below the fold hit nothing; each row is now scrolled into view first, and the hit must be the row or inside it (stricter than before).
- journey "read a source": my link locator matched Leaflet's hidden attribution link; now only links inside the opened Source (`details[open] a`, `.cite-link`).
- real-data: the phone appears three times on the APCO page (tel link, hours note, text); assert `.first()`. APCO's merged name "APCO Recycling (Grand Falls-Windsor Green Depot)" is found by the `/apco/i` match; exact hours and Sunday closed verified.
- Result: `npx playwright test` → **68 passed, 0 skipped**, chromium + webkit × phone + desktop. Real-data "Source for every Yes/No" passed across all depots on every project.
- `npm run test:unit` from this worktree: c7's `worker/tests/api.test.mjs` reports `no PIN -> 401: VOID` because no `wrangler dev` with `.dev.vars` is running here (the right PIN also got 401). Not my file; Onyx's pinned run had it green with the Worker up. Not a c8 defect.
- Screenshots (`*.png`) are now ignored inside `app/tests/qa/shots/` — generated per run, not evidence to commit.
