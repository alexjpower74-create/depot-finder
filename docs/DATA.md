# Depot data — `data/depots.json`

One JSON array, one row per Green Depot in Newfoundland and Labrador. Built by `node data/build.mjs` from the raw source captures in `docs/sources/_raw/` plus a hand-curated table inside the builder. Checked by `node --test data/validate.mjs`. Summarised by `node data/summary.mjs`.

Last full research pass: **2026-09-13**.

## The honesty rule

Nothing in this file is invented. Every name, address, coordinate, phone number and set of hours comes from a saved source. Every **Yes** or **No** on the five variables carries a citation (URL, date fetched, quoted line). If no source says it, the verdict is **Unknown** and the app must say "Unknown, call to confirm". Absence from a program list is never a No. The only blanket claim allowed is that every Green Depot takes beverage containers.

## Row schema

```jsonc
{
  "id": "bay-roberts",                 // kebab-case, unique, stable; used in URLs and correction reports
  "name": "Bay Roberts Green Depot",   // MMSB's listing name (en dashes normalised to hyphens)
  "type": "depot",                     // "depot" (fixed location) | "affiliate" (Labrador school/organisation) | "mobile" (collection events)
  "town": "Bay Roberts",
  "region": "Avalon",                  // Avalon | Eastern | Central | Western | Northern Peninsula | Labrador
  "address": "40 Neck Road, Coley’s Point, Bay Roberts, NL",
  "lat": 47.5876, "lng": -53.2648,     // from MMSB's map markers
  "tz": "America/St_Johns",            // or "America/Goose_Bay" for Labrador outside the Straits
  "phone": "709-786-2120",             // NNN-NNN-NNNN or null
  "website": null, "facebook": null,   // absolute URLs or null
  "hours": {
    "mon": "closed",                   // "closed" | "HH:MM-HH:MM" | "HH:MM-HH:MM,HH:MM-HH:MM" (split day) | null (unknown / by appointment)
    "tue": "08:30-12:00,12:30-16:30", "wed": "…", "thu": "…", "fri": "…", "sat": "…", "sun": "closed",
    "note": "Wed: opening at 12:30pm on January 28th, 2026 …"   // free text: one-off closures, Xpress-only days, appointment days, time zone; or null
  },
  "accepts": {
    "beverage":        { "verdict": "yes", "note": "…" },                       // always yes, no cite needed
    "refillable_beer": { "verdict": "yes|no|unknown", "cite": { "url", "fetched", "quote" } | null, "note"?: "…" },
    "iceberg_bottles": { … }, "paper_cardboard": { … }, "paint": { … }, "electronics": { … }
  },
  "notice": "NOTICE: … " | null,       // MMSB's dated notice text for the depot, verbatim, if any
  "sources": [ { "url": "…", "fetched": "2026-09-13", "what": "…" } ],
  "last_checked": "2026-09-13",
  "confidence": "verified|partial|listing-only",
  "alias_note"?: "…", "phone_note"?: "…"   // optional explanations
}
```

Times are 24-hour local time in the row's `tz`. A split day is two ranges joined by a comma; the gap is a closure (usually lunch). `null` for a day means the source gave no usable hours for that day (appointment-only days, or no hours listed at all); the `note` says why.

## Verdict rules

| Variable | Yes when | No when | Otherwise |
|---|---|---|---|
| `beverage` | always | never | — |
| `paint` | on Product Care Recycling's NL locator, or MMSB's own listing says "also accepts paint" | the depot or town says so | unknown |
| `electronics` | on EPRA's NL locator (recyclemyelectronics.ca), or MMSB / the operator's site / the town says so | the operator says it takes electronics only at other locations (Ever Green) | unknown |
| `paper_cardboard` | MMSB listing, operator site or town page says residential paper/cardboard is taken | operator says commercial-only (Ever Green) | unknown |
| `refillable_beer` | the depot itself (owner statement or site), MMSB, or the brewer says so | the depot or town says so | unknown |
| `iceberg_bottles` | same as refillable beer, naming Quidi Vidi / Iceberg / blue bottles, or a statement covering all beer bottles | same | unknown |

Why refillables default to Unknown: MMSB's FAQ says refillable beer bottles (Labatt, Molson, Quidi Vidi) are outside the deposit program, that "some Green Depot locations will accept refillable beer bottles" as an added service, and to "call your local depot to confirm". Neither MMSB nor the brewers publish a list. Quidi Vidi's own bottle return is at its Hops Shop (store credit); the Brewers Bottle Depot on Logy Bay Road in St. John's handles Labatt/Molson refillables. So a depot-level Yes or No needs a depot-level source. MMSB's own ReThinkWasteNL tool (archived 2020–2021, saved under `docs/sources/_raw/wayback/rethink/`) confirms this: for every region it lists only beer retailers, the Brewers Bottle Depots (709-368-3213, 709-722-3300), Fitz's Cold Beer and Quidi Vidi itself, never a Green Depot. The full per-depot search record is `docs/sources/_raw/SEARCH-LOG.md`.

A cite `url` is normally an `https://` URL. The one exception is the owner statement for APCO Recycling (Grand Falls-Windsor), which is recorded in `PLAN.md` and cited as `docs/sources/grand-falls-windsor/owner-statement.txt`.

## Confidence

- **verified** — MMSB listing plus at least one independent source that is not a program locator (operator's own site, town page, or owner statement) corroborating the depot.
- **partial** — MMSB listing plus a program locator entry (Product Care and/or EPRA) only.
- **listing-only** — MMSB listing only. Address, phone and hours are still sourced; nothing was found to cross-check them.

Confidence is about the row as a whole, not about any one verdict. A listing-only depot can still have a cited Yes on paint from MMSB's own text.

## Sources

Every page relied on is saved twice: the untouched capture in `docs/sources/_raw/` (see its `INDEX.md`), and a text copy with `URL:`, `Fetched:` and `What:` header lines under `docs/sources/<depot-id>/`. Citations survive link rot that way. Main sources:

- **MMSB "Find a Green Depot"** — https://mmsb.nl.ca/green-depot/ — the master list (64 blocks: 53 depots or events, 9 Labrador affiliates, one closed depot, one duplicate). Server-rendered; no JSON endpoint. Returns 403 to non-browser user agents.
- **Product Care Recycling locator** — https://www.productcare.org/recycling-locator/ — the whole Canadian site list is embedded in the page; 68 NL entries, 14 of them Green Depots.
- **EPRA Recycle My Electronics NL** — https://recyclemyelectronics.ca/nl/where-can-i-recycle — a client-side app; the record list comes from its `/api/v1/locations` endpoint (76 NL entries, 19 of them Green Depots).
- **Operator sites** — Scotia Recycling (Corner Brook, Mount Pearl, Paradise, Stephenville) and Ever Green Recycling (four St. John's depots and CBS).
- **Town pages** — Rocky Harbour, Lewisporte, Gander, Bay Roberts, Bonavista, Deer Lake, Mount Pearl, Port aux Basques, Conception Bay South.
- **MMSB FAQ** — https://mmsb.nl.ca/faq/ — the refillables policy.

Not used: Facebook pages (not fetchable without a logged-in browser; linked in `facebook` where known), business directories (unsourced, often stale), and the Wayback Machine copies of the old greendepotnl.ca pages (2017, and they carry no acceptance lists).

## Rows deliberately left out

- **Pasadena Green Depot** — MMSB: "NOTICE: This location has closed."
- **Robert's Arm Green Depot** — duplicate of Green Bay South Green Depot (same address, phone and hours); kept once as `green-bay-south` with an `alias_note`.

## Time zones

Newfoundland time everywhere except Labrador, which is Atlantic time apart from the Labrador Straits (`labrador-straits`) — and, by the usual reading of the zone boundary, Black Tickle (`black-tickle-erdc`). Affiliates carry no hours, so the Black Tickle choice does not affect "open now".

## Adding or correcting a depot

1. Save the source page: fetch it into `docs/sources/_raw/` (browser user agent for mmsb.nl.ca) and add a line to `docs/sources/_raw/INDEX.md`.
2. Edit the curated table in `data/build.mjs`: add or change the entry keyed by MMSB's exact name (id, town, region, tz, matched Product Care title/city, EPRA `location_id`, extra sources, and any depot-level statements such as `beerNo` / `paperYes`). A new depot must also exist in `mmsb_green-depot_parsed.json` (re-run the parser in the raw folder, or add the row by hand with its source).
3. `node data/build.mjs` — regenerates `depots.json` and the per-depot citation files.
4. `node --test data/validate.mjs` must pass; `node data/summary.mjs` shows the effect.
5. Commit `data/**` and `docs/sources/**` together.

Corrections submitted through the app land in the Worker's `df_corrections` table (see `docs/API.md`); they are proposals, not data. Apply them here only with a source.
