// data.mock.js — five SYNTHETIC depots for ?mock=1. None of these exist.
// Hours are generated relative to the current St. John's clock so the list always shows
// an open / closes-soon / closed / unknown spread, whatever time the tests run.
import { localNow, DAYS, DEFAULT_TZ } from './hours.js';

function hm(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function week(spec) {
  const h = {};
  for (const d of DAYS) h[d] = spec;
  return h;
}
const cite = (what) => ({
  url: 'https://example.invalid/sample-source',
  fetched: '2026-09-13',
  quote: `Sample source line: ${what}`,
});
const V = (verdict, what) => ({ verdict, cite: verdict === 'unknown' ? null : cite(what) });

export function mockDepots(now = new Date()) {
  const { minutes } = localNow(now, DEFAULT_TZ);
  const openNow = week(`${hm(minutes - 180)}-${hm(minutes + 180)}`);          // open, 3 h left
  const closesSoon = week(`${hm(minutes - 300)}-${hm(minutes + 20)}`);        // closes in 20 min
  const closedNow = week(`${hm(minutes + 90)}-${hm(minutes + 240)}`);         // opens in 90 min
  // Sample Depot Four: hours unknown every day.
  const unknownHours = { ...week(null), note: 'Hours not published' };
  // Sample Depot Five: split lunch, open now, Labrador (Atlantic time).
  const split = { ...week(`${hm(minutes - 240)}-${hm(minutes - 120)},${hm(minutes - 90)}-${hm(minutes + 150)}`),
    note: 'Atlantic time' };

  return [
    {
      id: 'sample-one', name: 'Sample Depot One', town: 'Sampletown', region: 'Avalon',
      address: '1 Example Road, Sampletown', lat: 47.56, lng: -52.71, phone: '709-000-0001',
      website: 'https://example.invalid/one', facebook: null,
      hours: { ...openNow, note: '' },
      accepts: {
        beverage: { verdict: 'yes', note: '' },
        refillable_beer: V('yes', 'we take refillable beer bottles'),
        iceberg_bottles: V('yes', 'Iceberg blue bottles accepted'),
        paper_cardboard: V('yes', 'paper and cardboard accepted'),
        paint: V('yes', 'listed as a paint drop-off site'),
        electronics: V('yes', 'listed as an electronics drop-off site'),
      },
      sources: [{ url: 'https://example.invalid/one', fetched: '2026-09-13', what: 'sample' }],
      last_checked: '2026-09-13', confidence: 'verified',
    },
    {
      id: 'sample-two', name: 'Sample Depot Two', town: 'Testport', region: 'Central',
      address: '2 Example Street, Testport', lat: 48.95, lng: -55.66, phone: '709-000-0002',
      website: null, facebook: null,
      hours: { ...closesSoon, note: '' },
      accepts: {
        beverage: { verdict: 'yes', note: '' },
        refillable_beer: V('no', 'we do not take refillable beer bottles'),
        iceberg_bottles: V('no', 'no Iceberg bottles'),
        paper_cardboard: V('no', 'no paper or cardboard'),
        paint: V('no', 'paint is not accepted here'),
        electronics: V('no', 'electronics are not accepted here'),
      },
      sources: [], last_checked: '2026-09-13', confidence: 'partial',
    },
    {
      id: 'sample-three', name: 'Sample Depot Three', town: 'Mockville', region: 'Western',
      address: '3 Example Avenue, Mockville', lat: 48.95, lng: -57.95, phone: null,
      website: null, facebook: null,
      hours: { ...closedNow, note: '' },
      accepts: {
        beverage: { verdict: 'yes', note: '' },
        refillable_beer: V('unknown'),
        iceberg_bottles: V('unknown'),
        paper_cardboard: V('unknown'),
        paint: V('unknown'),
        electronics: V('unknown'),
      },
      sources: [], last_checked: '2026-09-13', confidence: 'listing-only',
    },
    {
      id: 'sample-four', name: 'Sample Depot Four', town: 'Placeholder Bay', region: 'Eastern',
      address: '4 Example Lane, Placeholder Bay', lat: 48.65, lng: -53.11, phone: '709-000-0004',
      website: null, facebook: 'https://example.invalid/four-fb',
      hours: unknownHours,
      accepts: {
        beverage: { verdict: 'yes', note: '' },
        refillable_beer: V('yes', 'refillables welcome'),
        iceberg_bottles: V('no', 'Iceberg bottles not taken'),
        paper_cardboard: V('unknown'),
        paint: V('yes', 'paint drop-off'),
        electronics: V('unknown'),
      },
      sources: [], last_checked: '2026-09-13', confidence: 'partial',
    },
    {
      id: 'sample-five', name: 'Sample Depot Five', town: 'Fixtureville', region: 'Labrador',
      address: '5 Example Drive, Fixtureville', lat: 53.30, lng: -60.33, phone: '709-000-0005',
      website: null, facebook: null, tz: 'America/Goose_Bay',
      hours: split,
      accepts: {
        beverage: { verdict: 'yes', note: '' },
        refillable_beer: V('unknown'),
        iceberg_bottles: V('yes', 'Iceberg bottles 5 cents'),
        paper_cardboard: V('no', 'no cardboard'),
        paint: V('unknown'),
        electronics: V('yes', 'electronics accepted'),
      },
      sources: [], last_checked: '2026-09-13', confidence: 'partial',
    },
  ];
}
