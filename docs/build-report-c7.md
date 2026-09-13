# Build report — c7 · Corrections Worker

Branch `rig/c7`, slice `worker/**`. Contract: `PLAN.md` (c7 section) and `docs/API.md`.
Note: `.rig/BRIEF.md` said "(none stated in the plan)" for my task, but PLAN.md states it in full; I followed PLAN.md.

## What I built — DONE

| File | Purpose |
|---|---|
| `worker/wrangler.toml` | name `depot-finder`, D1 binding `DB` on `e32262b9-ade2-4963-8441-ed1709d6b25d` (database_name `bottle-count`), `migrations_dir = "migrations"`, vars `VERSION`, `APP_ORIGINS` |
| `worker/migrations/0001_df.sql` | `df_corrections(id, depot_id, field, proposed, note, contact, created, ip_hash)` + indexes on `(ip_hash, created)` and `(field)`. All objects prefixed `df_`; `IF NOT EXISTS` so it is safe on the shared database. |
| `worker/src/index.mjs` | The Worker: `GET /health`, `POST /correction`, `GET /corrections`, `GET /stats`, CORS, 404/405/500 JSON errors |
| `worker/tests/api.test.mjs` | `node --test` suite; boots `npx wrangler dev --port 6002` itself (applies local migrations first), or targets `API=<url>` |
| `worker/package.json` | `npm run migrate:local`, `npm run dev`, `npm test` |
| `worker/.dev.vars.example`, `worker/.gitignore` | `.dev.vars` (local `ADMIN_PIN`, `IP_SALT`) and `.wrangler/` are ignored, never committed |

Behaviour, per `docs/API.md`:
- `POST /correction`: body must be a JSON object; `depot_id` non-empty string (≤100), `field` exactly one of `hours|phone|address|refillable_beer|iceberg_bottles|paper_cardboard|paint|electronics|other` (case-sensitive), `proposed` non-empty ≤500, optional `note` ≤500 and `contact` ≤200. Strings are trimmed. Anything else is `400 {error}` with a plain-English reason. Stored rows get a UUID `id`, ISO `created`, and `ip_hash = sha256(ip + "|" + IP_SALT)`. Returns `201 {id}`.
- Rate guard: counts stored corrections for the same `ip_hash` in the last hour; the 61st is `429` with `Retry-After: 3600`. IP comes from `CF-Connecting-IP` (Cloudflare sets and overwrites it at the edge; the tests set it locally to isolate cases).
- `GET /corrections`: `Authorization: Bearer <ADMIN_PIN>` **or** `?pin=<ADMIN_PIN>` (PLAN mentions `?pin=`, API.md mentions Bearer; both work). Constant-time compare. 401 if missing/wrong, and 401 always if the `ADMIN_PIN` secret is unset. Returns newest-first, max 1000 rows, **without** `ip_hash`.
- `GET /stats`: `{corrections: n, by_field: {field: n}}`.
- `GET /health`: `{ok: true, version}` (`VERSION` var, `1.0.0`).
- CORS: origin is echoed only if it is `localhost` / `127.0.0.1` / `[::1]` on any port, a `depot-finder*.<anything>.workers.dev` host, or listed in `APP_ORIGINS`. Foreign origins get no `Access-Control-Allow-Origin`. Preflight is 204.

## What I verified and how it could have failed

Run: `cd worker && npm test` — 8 tests, 43 assertions, all through a `check()` helper that runs each assertion **and a negative control** that must fail the same predicate; a check whose control also passes is reported `VOID` and fails the test. (`rig-harness` is not installed on this machine, so `check()` is implemented in the test file with the same semantics.) Final run: `pass 8, fail 0`, zero VOID.

- health ok + unknown route 404
- valid correction → 201 with a UUID; row round-trips every field via admin; `ip_hash` not exposed
- 400 on: unknown field, missing depot_id, missing/empty proposed, proposed/note/contact over limit, non-string depot_id, array body, invalid JSON; 405 on `GET /correction`
- all nine whitelisted fields accepted; `"Hours"` (wrong case) rejected as the control
- 401 with no PIN and with a wrong PIN; 200 with the right PIN via header and via `?pin=`
- rate guard: 60 posts from one IP all 201, the 61st 429 with `Retry-After`; a different IP still 201
- stats: total grows by exactly 3 after 3 valid + 1 rejected post; per-field deltas; the rejected field's count does not grow
- CORS: localhost echoed, `depot-finder-app.example.workers.dev` echoed, `evil.example` gets no ACAO, preflight 204 with POST

**Mandated negative control (whitelist drop):** replaced `if (!FIELDS.includes(body.field))` with `if (false)`, reran:
```
  [VOID] valid correction -> 201         (its control, a bogus field, now also returns 201)
  [FAIL] 400: unknown field name
  [VOID] field accepted: hours
  [FAIL] total grew by exactly 3         (the rejected post now counts)
ℹ pass 4  ℹ fail 4
```
Restored the source (verified `grep -c "NEGATIVE CONTROL" src/index.mjs` → 0), reran → `pass 8, fail 0`.

Lesson recorded: the first post-restore run failed once because the negative run had stored `field="bogus"` rows in the local D1 and a stats check asserted that key was absent. I changed that check to a run-scoped delta (bogus count must not grow) so the suite is honest against any pre-existing database, including production via `API=`.

Manual curl smoke against `wrangler dev` before the suite: every route, preflight, and a foreign origin, as expected. Numbers above are from my own worktree; c8 / main should re-run `npm test` from the QA worktree pinned to this commit.

## Left undone / decisions to flag

- **`APP_ORIGINS` is empty.** The real static-assets Worker origin (`depot-finder-app.<account>.workers.dev` or a custom domain) is main's to know. The `depot-finder*.*.workers.dev` pattern should cover the default subdomain; a custom domain must be added to `APP_ORIGINS` in `wrangler.toml` (my file, happy to add it) or as a var at deploy time.
- **Remote migration not applied.** I did not touch the remote database. Main runs `cd worker && npx wrangler d1 migrations apply DB --remote` (uses the `d1_migrations` tracking table that bottle-count may already have; the migration only creates `df_`-prefixed objects), then `npx wrangler secret put ADMIN_PIN` and optionally `IP_SALT`, then `npx wrangler deploy`.
- Rate guard is keyed on a salted IP hash stored with corrections, not a separate counter table; requests that fail validation do not count toward the limit.
- `GET /corrections` returns at most 1000 rows, newest first. No pagination; fine at this scale.
- No changes needed outside `worker/**`. `docs/API.md` (main's) matches what I built; the one addition is that `?pin=` is also accepted, per PLAN.

## For other slices
- **c6 (app):** `api.js` should `POST ${API}/correction` with JSON `{depot_id, field, proposed, note?, contact?}`, expect `201 {id}`, show the `error` string from a 400/429. Field names above are the only ones the Worker accepts, so map the depot page's five verdict variables plus hours/phone/address/other exactly.
- **c8 (live round-trip):** `cd worker && API=https://depot-finder.<account>.workers.dev ADMIN_PIN=<pin> npm test` runs this same suite against the real Worker; the rate-guard test will consume 61 corrections from one IP there, so you may prefer `tests/live-roundtrip.mjs` for the smoke and this suite only locally.
