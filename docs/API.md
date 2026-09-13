# Depot Finder Worker API

Base: Worker `depot-finder`. JSON in, JSON out. CORS: app origin + localhost.

- `GET /health` → `{ok:true, version}`
- `POST /correction` body `{depot_id: string, field: one of "hours"|"phone"|"address"|"refillable_beer"|"iceberg_bottles"|"paper_cardboard"|"paint"|"electronics"|"other", proposed: string (≤500), note?: string (≤500), contact?: string (≤200)}` → 201 `{id}`; 400 `{error}` on bad shape or unknown field; 429 over 60/h/IP.
- `GET /corrections` header `Authorization: Bearer <ADMIN_PIN>` → `[{...}]`; 401 otherwise.
- `GET /stats` → `{corrections: n, by_field: {...}}`
