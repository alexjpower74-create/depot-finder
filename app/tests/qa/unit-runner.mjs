// Runs every node --test suite the contract names, but only the ones that exist yet.
// Missing suites are listed as SKIPPED so a half-built tree reads honestly rather than green.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const suites = [
  { path: 'data/validate.mjs', owner: 'c5', what: 'depots.json schema + APCO ground truth' },
  { path: 'app/hours.test.mjs', owner: 'c6', what: 'open-now in America/St_Johns + Labrador' },
  { path: 'app/tests/hours.test.mjs', owner: 'c6', what: 'open-now (alt location)' },
  { path: 'worker/tests/api.test.mjs', owner: 'c7', what: 'Worker API against wrangler dev :6002' },
];

const present = suites.filter((s) => existsSync(s.path));
const missing = suites.filter((s) => !existsSync(s.path));
for (const s of missing) console.log(`SKIPPED  ${s.path}  (${s.owner}: ${s.what}) — file not present`);
if (present.length === 0) {
  console.log('unit-runner: no node --test suites present yet; nothing measured.');
  process.exit(0);
}
const r = spawnSync(process.execPath, ['--test', ...present.map((s) => s.path)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
