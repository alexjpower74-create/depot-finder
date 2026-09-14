// config.js — deployment knobs. Main sets DEPOT_FINDER_API to the deployed Worker URL.
// Locally the Worker runs on port 6002 (wrangler dev), so localhost defaults there.
const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const API_BASE = window.DEPOT_FINDER_API || (local ? 'http://localhost:6002' : 'https://depot-finder.alexjpower74.workers.dev');
export const DATA_PATHS = ['../data/depots.json', 'data/depots.json'];
