// Prints counts per verdict per variable, plus confidence and type counts.
//   node data/summary.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const depots = JSON.parse(fs.readFileSync(path.join(here, 'depots.json'), 'utf8'));
const VARS = ['refillable_beer', 'iceberg_bottles', 'paper_cardboard', 'paint', 'electronics'];

const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const pad = (s, n) => String(s).padEnd(n);

console.log(`Depot Finder — ${depots.length} rows in data/depots.json (last_checked ${[...new Set(depots.map(d => d.last_checked))].join(', ')})\n`);

console.log('By type:       ', count(depots, d => d.type));
console.log('By confidence: ', count(depots, d => d.confidence));
console.log('By region:     ', count(depots, d => d.region));
console.log('');

console.log(pad('variable', 18) + pad('yes', 6) + pad('no', 6) + pad('unknown', 9) + 'cited yes/no');
for (const v of VARS) {
  const c = count(depots, d => d.accepts[v].verdict);
  const cited = depots.filter(d => d.accepts[v].verdict !== 'unknown' && d.accepts[v].cite).length;
  console.log(pad(v, 18) + pad(c.yes || 0, 6) + pad(c.no || 0, 6) + pad(c.unknown || 0, 9) + cited);
}
console.log('');

const noHours = depots.filter(d => d.type === 'depot' && ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].every(k => d.hours[k] === null));
const noPhone = depots.filter(d => !d.phone);
console.log(`Fixed depots with no hours at all: ${noHours.length}${noHours.length ? ' (' + noHours.map(d => d.id).join(', ') + ')' : ''}`);
console.log(`Rows with no phone: ${noPhone.length}${noPhone.length ? ' (' + noPhone.map(d => d.id).join(', ') + ')' : ''}`);
