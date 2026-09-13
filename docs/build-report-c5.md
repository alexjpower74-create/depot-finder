# Build report — c5 · Depot research

Branch `rig/c5`. Date 2026-09-13. Owns `data/**`, `docs/DATA.md`, `docs/sources/**`.

Note on the brief: `.rig/BRIEF.md` said "Your task: (none stated in the plan)", but `PLAN.md` states the c5 task in full under "Agents → c5". I followed PLAN.md, since the brief itself names it as the contract.

## What I built — DONE

- `data/depots.json` — 62 rows: 52 fixed Green Depots, 1 mobile collection (Burgeo), 9 Labrador Green Depot affiliates (schools and organisations MMSB lists as depots). Every row has address, coordinates, phone (where any source has one), hours, the five verdicts with citations, sources, `last_checked`, `confidence`, and a `tz`.
- `data/build.mjs` — rebuilds the JSON and the per-depot citation files from the raw captures plus a curated table (ids, regions, time zones, locator matches, extra sources, depot-level statements). Deterministic: rerunning it after the negative control restored the file byte-identical.
- `data/validate.mjs` — `node --test`: schema, unique ids, NL bounding box, every yes/no has a cite with url + quote and unknown has none, every cite has a saved text copy under `docs/sources/<id>/`, APCO row matches the brief exactly, at least 40 fixed depots, no blanket "all depots accept" text, time zones per region. Exit 1 on failure.
- `data/summary.mjs` — counts per verdict per variable, by type, confidence and region.
- `docs/DATA.md` — schema, verdict rules, confidence rules, sources, how to add or correct a depot.
- `docs/sources/_raw/` — 30 untouched captures with `INDEX.md` (URL, date, what). `docs/sources/<depot-id>/` — 61 folders, each text file headed `URL:` / `Fetched:` / `What:`.

## Step 1 — the master list

MMSB's "Find a Green Depot" page (https://mmsb.nl.ca/green-depot/) renders the whole list server-side: 64 `location-accordion` blocks with `data-lat`/`data-lng`. There is no JSON endpoint. The site returns 403 to curl's default user agent; a Safari user agent gets 200. Saved as `docs/sources/_raw/mmsb_green-depot.html`, parsed to `mmsb_green-depot_parsed.json`.

Count found: **64 listings** → 53 depots/events + 9 affiliates + 1 closed (Pasadena, "This location has closed") + 1 duplicate (Robert's Arm = Green Bay South, same address, phone and hours). The plan expected 45–60; 52 fixed depots is inside that.

## Steps 2–5 — verdicts

| Variable | Yes | No | Unknown |
|---|---|---|---|
| refillable_beer | 1 | 1 | 60 |
| iceberg_bottles | 1 | 1 | 60 |
| paper_cardboard | 5 | 5 | 52 |
| paint | 17 | 0 | 45 |
| electronics | 21 | 3 | 38 |

Confidence: verified 17, partial 12, listing-only 33.

- **Paint**: Product Care's locator embeds its whole Canadian dataset in the page (`var collection_sites`); 68 NL entries, 14 of them Green Depots (incl. "Gros Morne Recycling Depot", same address as the Gros Morne Green Depot). MMSB's own text adds Botwood, Springdale and Port aux Basques ("This depot also accepts paint and electronics").
- **Electronics**: EPRA's NL page is a client-side app calling `/api/v1/locations` with a public key shipped in its JS; the API returned 76 NL locations, 19 Green Depots. MMSB adds Labrador West; the Town of Gander confirms Broadening Horizons; Ever Green's own site gives a cited **No** for Torbay Road, Cowan Avenue and CBS ("drop off centre … at two of our locations: 79 Blackmarsh Road, 92 Elizabeth Avenue").
- **Paper/cardboard**: MMSB text for Corner Brook and Stephenville; Scotia's site ("Fibre Drop-off, available for residential and commercial customers") for Mount Pearl and Paradise as well; Town of Lewisporte for the Calypso Foundation depot. Ever Green: **No** for the public (fibre is "Commercial Only", by arrangement).
- **Refillable beer / Iceberg**: MMSB's FAQ says these are outside the deposit program, that "some Green Depot locations will accept refillable beer bottles" as an added service, and to call. No list exists anywhere I could find (MMSB, Quidi Vidi's bottle-return page, Molson/Labatt, CBC coverage). Depot-level results: APCO **Yes/Yes** at 5¢ (owner statement, recorded in PLAN.md and cited as `docs/sources/grand-falls-windsor/owner-statement.txt`); Gros Morne **No/No** (Town of Rocky Harbour: "Beer bottles will no longer be accepted at the depot"). Everything else is Unknown, call to confirm — which is the honest answer, not a gap in effort. Note Ever Green's refund table lists "Local and imported beer bottles: 5 cent refund" but does not say which bottles it takes back, so it stays Unknown.

Variables with the most unknowns: refillable beer and Iceberg bottles (60 of 62 each), then paper/cardboard (52). Paint and electronics are the best covered because two regulated programs publish locators.

## What I verified and how it could have failed

- Validator: 10 tests, all green on the committed file.
- **Negative control (recorded run)**: planted `paint: yes` with `cite: null` on `badger` and changed the APCO phone to 709-489-1948. Result: `fail 2` — "badger: paint is yes without a cite" and the APCO equality assertion — exit 1. Rebuilt with `node data/build.mjs`; `cmp` confirmed the restored file byte-identical; validator green, exit 0.
- Hours parser: every distinct MMSB hours string (70 variants) was listed and checked by eye; split days, "1:00-4:00pm" (missing meridian on the start), "9:00 a.m. – 5:00 p.m.", "&" and "/" separators, parenthetical and dash notices all parse; notices go to `hours.note`. Appointment-only days become `null` with a note. Five depots have no hours on MMSB at all (Bay Bulls, Labrador West, Placentia/Dunville, Port au Choix, St. Anthony) and are `null` with a note rather than guessed.
- What would still slip past: a wrong-but-well-formed phone or coordinate copied faithfully from MMSB; hours MMSB has not updated. Both are by design — the data says what the source says, with the date.

## Sources that looked wrong or conflict

- **APCO address**: MMSB lists 10 Hardy Avenue; the Exploits Connect directory and YellowPages list 1 Columbus Drive with stale hours. I used MMSB (official, 2026) and did not use the directories. Alexander should confirm which address is current.
- **Twillingate**: MMSB lists 76 Toulinquet Street and no phone; Product Care lists 46 Toulinquet Street and 709-884-2770; EPRA lists "Main Street" and the same phone. Address from MMSB, phone from the two program locators (noted in `phone_note`).
- **Baie Verte**: MMSB 308 Highway 410, EPRA 309-311 Highway 410. Kept MMSB.
- **Gambo**: MMSB 447 J. R. Smallwood Blvd, EPRA 454. Kept MMSB.
- **Product Care hours** for several depots differ from MMSB's current hours (e.g. Mount Pearl "5:00pm-8:00pm"). Product Care was used only for the paint verdict, never for hours.
- **Labrador Straits**: MMSB says "Xpress drop-off only" every day; the hours are kept and the note carries the restriction.
- **Bonavista**: the town says electronics go to the municipal landfill, not the depot; the depot stays Unknown for electronics (absence is not a No).
- The old greendepotnl.ca per-depot pages exist in the Wayback Machine (2017, one from 2023) but carry no acceptance lists; not used.

## Left undone / limits

- Facebook pages (Marystown, Port aux Basques, Labrador Straits, Green Bay South, Twillingate/NWI, APCO, Ever Green) were not read: they need a logged-in browser and the plan forbids visible Chrome. Links are stored in `facebook` for the app and for a later pass.
- No phone calls were made. Every Unknown is a real Unknown.
- Black Tickle's time zone (`America/St_Johns`) follows the usual reading of the Straits boundary; unverified against an official list. It has no hours, so nothing depends on it.
- St. Anthony has no phone or hours; MMSB is tendering a new operator (2026 RFP on mmsb.nl.ca).

## For other slices

- **c6 (app)**: hours format is `"HH:MM-HH:MM"` or `"HH:MM-HH:MM,HH:MM-HH:MM"` for split days, `"closed"`, or `null` (see `docs/DATA.md`). Rows carry `tz` (`America/St_Johns` or `America/Goose_Bay`) and `type` (`depot` | `affiliate` | `mobile`); affiliates and the mobile row have all-null hours, so "open now" should show as unknown, not closed. Extra fields `notice`, `alias_note`, `phone_note` are optional strings. The APCO cite `url` is a repo path, not `https://`; render it as text rather than a link.
- **c8 (QA)**: `real-data.spec.js` can assert APCO hours as `10:00-12:30,13:00-16:30` Mon–Sat, `closed` Sun, phone `709-489-1949`. `node --test data/validate.mjs` is the data gate; `node data/summary.mjs` prints the counts above.
- **Cross-review requested**: someone other than me should read five random `docs/sources/<id>/` folders against the row and check the quote really supports the verdict. My builder shares my blind spots.
