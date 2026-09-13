# Raw source captures (shared, province-wide)

All fetched 2026-09-13 with curl (browser user agent; mmsb.nl.ca returns 403 to curl's default UA).
Per-depot citation text files live in `docs/sources/<depot-id>/`; these are the untouched originals.

| File | URL | What |
|---|---|---|
| mmsb_green-depot.html | https://mmsb.nl.ca/green-depot/ | MMSB "Find a Green Depot" page. The full depot list is embedded server-side as 64 `location-accordion` blocks with `data-lat`/`data-lng` (no separate JSON endpoint). |
| mmsb_green-depot_parsed.json | (derived from the above) | The 64 blocks parsed: name, address, lat/lng, phone, hours, description, mailto links. |
| mmsb_home.html | https://mmsb.nl.ca/ | Homepage, used only to find the locator link. |
| mmsb_faq.html | https://mmsb.nl.ca/faq/ | MMSB FAQ incl. "Why do some Green Depots accept refillable beer bottles, but others don't?" |
| mmsb.nl.ca_faq-type_whats-accepted-not-accepted_.html | https://mmsb.nl.ca/faq-type/whats-accepted-not-accepted/ | FAQ subset. |
| mmsb_programs_used-beverage-containers.html | https://mmsb.nl.ca/programs/used-beverage-containers/ | Deposit/refund table; "Refillable containers ... are not accepted at Green Depots." |
| mmsb_programs_paint.html | https://mmsb.nl.ca/programs/paint/ | Points to Product Care as the paint EPR body. |
| mmsb_programs_electronics.html | https://mmsb.nl.ca/programs/electronics/ | Points to EPRA as the electronics EPR body. |
| mmsb.nl.ca_beverage-container-recycling_.html | https://mmsb.nl.ca/programs/beverage-container-recycling-network-of-canada/ | Redirect target; not used. |
| www.productcare.org_recycling-locator_.html | https://www.productcare.org/recycling-locator/ | Product Care locator; whole Canadian site list embedded as `var collection_sites = [...]`. |
| productcare_locator_NL.json | (derived) | The 68 entries whose province is Newfoundland & Labrador. |
| www.productcare.org_province_newfoundland_.html, www.productcare.org_products_paint_newfoundland_.html | productcare.org NL pages | Program description. |
| www.recyclemyelectronics.ca_nl_.html, epra_nl_where-can-i-recycle.html | https://recyclemyelectronics.ca/nl , /nl/where-can-i-recycle | EPRA NL pages. The locator is a client-side app calling `/api/v1/locations` with a public key shipped in the page JS. |
| epra_api_provinces.json | https://recyclemyelectronics.ca/api/v1/provinces?lang=en-CA | Province list. |
| epra_api_locations_NL.json | https://recyclemyelectronics.ca/api/v1/locations?lang=en-CA&province=Newfoundland%20and%20Labrador&search_radius=2000&coordinates=49.0,-56.0&data_source_table=location | All 76 NL drop-off locations (radius 2000 km from the island's centre covers all of Labrador). |
| scotiarecycling.com.html, scotia_depot-services.html | https://scotiarecycling.com/ , /depot-services/ | Scotia Recycling (Corner Brook, Mount Pearl, Paradise, Stephenville): paint, electronics, fibre drop-off. |
| www.greencan.ca.html, greencan_*.html | https://www.greencan.ca/?page=... | Ever Green Recycling (St. John's x4 + CBS): electronics at Blackmarsh & Elizabeth; fibre commercial only; beer bottle refund line. |
| quidividibrewery.ca_pages_quidi-vidi-bottle-return.html | https://quidividibrewery.ca/pages/quidi-vidi-bottle-return | Brewery's own bottle return (store credit at the Hops Shop). Names no depots. |
| www.cbc.ca_..._quidi-vidi-bottles-1.4761631.html | CBC 2018-07 | "returning the blue bottles to the brewery and to local recycling depots"; names no depots. |
| www.cbc.ca_..._iceberg-beer-maker-hikes-bottle-reward...html | CBC 2012 | Historic; brewery paid 20¢ per blue bottle. Names no depots. |
| exploitsconnect.ca_directory_apco-recycling_.html | https://exploitsconnect.ca/directory/apco-recycling/ | Directory listing for APCO: address 1 Columbus Drive and stale hours. Conflicts with MMSB (10 Hardy Avenue) and the brief; recorded, not used. |
| wayback/rethink/beer_<region>_<date>.html (12) | web.archive.org copies of https://rethinkwastenl.ca/rtw-category/domestic-beer-bottles/?region=… (2020–2021) | MMSB's ReThinkWasteNL "Refillable Beer Bottles" page per region. Names only beer retailers, Brewers Bottle Depots, Fitz's Cold Beer and Quidi Vidi; no Green Depot in any region. |
| wayback/rethink/paper_<region>_20180815.html (12) | web.archive.org copies of https://rethinkwastenl.ca/rtw-category/paper-and-cardboard/?region=… (2018) | Same tool, paper and cardboard. Names Scotia's depots (Corner Brook, Stephenville, Mount Pearl, Paradise, and at that time Gander and Grand Falls-Windsor) for limited residential paper/cardboard. Used only as corroboration in notes. |
| wayback/rethink_beer-bottles_2022-05-19.html, wayback/rethink_domestic-beer-bottles_2019-08-21.html | archived category pages | Policy text; no depots. |
| wayback/botwood-2023.html, wayback/gfw-2017.html | archived greendepotnl.ca depot pages | Sampled; hours only, no acceptance lists. Not used. |
| wayback_cdx_*.txt | Wayback CDX index queries | What is archived. |
| SEARCH-LOG.md | (log) | Every WebSearch query run per depot and what came back. |
| totext.py | (tool) | HTML to text helper used to produce the per-depot citation files. |
