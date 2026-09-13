// Builds data/depots.json from the raw source captures in docs/sources/_raw
// plus the hand-curated table below, and writes per-depot citation text files
// under docs/sources/<depot-id>/.
//
//   node data/build.mjs
//
// Verdict rules (see docs/DATA.md):
//   - beverage: always yes (every Green Depot is licensed for MMSB containers).
//   - paint: yes if the depot is on Product Care's NL locator, or MMSB's own
//     listing says it accepts paint; otherwise unknown.
//   - electronics: yes if the depot is on EPRA's NL locator, or MMSB / the
//     depot's own site / the town says so; otherwise unknown.
//   - paper_cardboard, refillable_beer, iceberg_bottles: only a cited yes/no
//     from the depot, the town, MMSB, or the brewer; otherwise unknown.
//   - Absence from a program locator is never a "no".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const raw = path.join(root, 'docs', 'sources', '_raw');
const out = path.join(root, 'data', 'depots.json');
const srcDir = path.join(root, 'docs', 'sources');

const FETCHED = '2026-09-13';
const MMSB_URL = 'https://mmsb.nl.ca/green-depot/';
const PC_URL = 'https://www.productcare.org/recycling-locator/';
const EPRA_URL =
  'https://recyclemyelectronics.ca/api/v1/locations?lang=en-CA&province=Newfoundland%20and%20Labrador&search_radius=2000&coordinates=49.0,-56.0&data_source_table=location';
const EPRA_PAGE = 'https://recyclemyelectronics.ca/nl/where-can-i-recycle';

const mmsb = JSON.parse(fs.readFileSync(path.join(raw, 'mmsb_green-depot_parsed.json'), 'utf8'));
const pc = JSON.parse(fs.readFileSync(path.join(raw, 'productcare_locator_NL.json'), 'utf8'));
const epra = JSON.parse(fs.readFileSync(path.join(raw, 'epra_api_locations_NL.json'), 'utf8')).locations;

// ---------------------------------------------------------------------------
// Curated table. One entry per MMSB listing we keep. Keys are the exact MMSB
// names. `pc` is the Product Care title+city to match; `epra` the EPRA
// location_id. `extra` holds additional cites/sources with their raw file.
// ---------------------------------------------------------------------------
const NST = 'America/St_Johns';
const AST = 'America/Goose_Bay';

const curated = {
  'Badger Green Depot': { id: 'badger', town: 'Badger', region: 'Central' },
  'Baie Verte Green Depot': { id: 'baie-verte', town: 'Baie Verte', region: 'Central', epra: 15623 },
  'Bay Bulls Green Depot': { id: 'bay-bulls', town: 'Bay Bulls', region: 'Avalon', hoursNote: 'MMSB lists no hours for this depot; call to confirm.' },
  'Bay Roberts Green Depot': {
    id: 'bay-roberts', town: 'Bay Roberts', region: 'Avalon',
    pc: ['Bay Roberts Green Depot', 'Bay Roberts'], epra: 158,
    extraSources: [
      { url: 'https://bayroberts.com/places/green-depot/', file: 'bayroberts.com_places_green-depot_.html', what: 'Town of Bay Roberts business listing: 40 Neck Road, 709-786-2120.' },
    ],
  },
  'Bell Island Green Depot': { id: 'bell-island', town: 'Bell Island', region: 'Avalon', pc: ['Bell Island Green Depot', 'Bell Island'] },
  'Blaketown Green Depot': { id: 'blaketown', town: 'Blaketown', region: 'Avalon' },
  'Bonavista Green Depot': {
    id: 'bonavista', town: 'Bonavista', region: 'Eastern',
    extraSources: [
      { url: 'https://www.townofbonavista.com/wastemangement', file: 'www.townofbonavista.com_wastemangement.html', what: 'Town of Bonavista waste page: Green Depot at 134 Confederation Drive, (709) 468-7791; electronics go to the municipal landfill, not the depot.' },
    ],
  },
  'Botwood Green Depot': { id: 'botwood', town: 'Botwood', region: 'Central' },
  'Buchans Green Depot': { id: 'buchans', town: 'Buchans', region: 'Central' },
  'Burgeo Mobile Collection': { id: 'burgeo-mobile', town: 'Burgeo', region: 'Western', type: 'mobile' },
  'Burnt Islands Green Depot': { id: 'burnt-islands', town: 'Burnt Islands', region: 'Western' },
  'Carbonear Green Depot': { id: 'carbonear', town: 'Carbonear', region: 'Avalon', pc: ['Carbonear Green Depot', 'Carbonear'], epra: 207 },
  'Clarenville Green Depot': { id: 'clarenville', town: 'Clarenville', region: 'Eastern' },
  'Coast of Bays Green Depot': { id: 'coast-of-bays', town: "St. Alban's", region: 'Central' },
  'Colliers Green Depot': { id: 'colliers', town: 'Colliers', region: 'Avalon' },
  'Conception Bay South Green Depot': {
    id: 'conception-bay-south', town: 'Conception Bay South', region: 'Avalon',
    website: 'https://www.greencan.ca/index.php?page=l_c_cbs', facebook: 'https://www.facebook.com/evergreennl',
    extraSources: [
      { url: 'https://www.greencan.ca/index.php?page=l_c_cbs', file: 'www.greencan.ca_index.php_page_l_c_cbs.html', what: 'Ever Green Recycling location page: 2684 Topsail Road, hours.' },
      { url: 'https://www.conceptionbaysouth.ca/businesses/c-b-s-green-depot/', file: 'www.conceptionbaysouth.ca_businesses_c-b-s-green-depot_.html', what: 'Town of CBS business listing: address, 709-758-5881, Mon-Sat 9-5.' },
    ],
    evergreen: { electronics: false },
  },
  'Corner Brook Green Depot': {
    id: 'corner-brook', town: 'Corner Brook', region: 'Western',
    website: 'https://scotiarecycling.com/depot-services/', pc: ['Corner Brook Green Depot', 'Corner Brook'], epra: 175, scotia: true,
  },
  'Deer Lake Green Depot': {
    id: 'deer-lake', town: 'Deer Lake', region: 'Western',
    extraSources: [
      { url: 'https://deerlake.ca/recycling-garbage-organics/recycling/', file: 'deerlake.ca_recycling_.html', what: "Town of Deer Lake recycling page: 'Sedler Green Depot, 32 Reid's Lane, (709) 635-3110'." },
    ],
  },
  'Fogo Island Green Depot': { id: 'fogo-island', town: 'Fogo', region: 'Central' },
  'Fortune Green Depot': { id: 'fortune', town: 'Fortune', region: 'Eastern' },
  'Gambo Green Depot': { id: 'gambo', town: 'Gambo', region: 'Central', epra: 17486 },
  'Gander Green Depot': {
    id: 'gander', town: 'Gander', region: 'Central', epra: 708,
    extraSources: [
      { url: 'https://www.gandercanada.com/home-property-and-roads/garbage-collection-and-disposal/', file: 'www.gandercanada.com_home-property-and-roads_garbage-collection-and-disposal_.html', what: 'Town of Gander: end-of-life electronics go to Broadening Horizons Green Depot, 12A Magee Drive.' },
    ],
    townElectronicsQuote: 'Where should I take my end-of-life electronics? Broadening Horizons Green Depot 12A Magee Drive Gander, NL, A1V 1W5',
    townElectronicsUrl: 'https://www.gandercanada.com/home-property-and-roads/garbage-collection-and-disposal/',
  },
  'Glovertown Green Depot': { id: 'glovertown', town: 'Glovertown', region: 'Central', pc: ['Glovertown Green Depot', 'Glovertown'], epra: 190 },
  'Grand Falls-Windsor Green Depot': {
    id: 'grand-falls-windsor', town: 'Grand Falls-Windsor', region: 'Central',
    facebook: 'https://www.facebook.com/apco.recycling/',
    apco: true,
  },
  'Green Bay South Green Depot': {
    id: 'green-bay-south', town: "Robert's Arm", region: 'Central', epra: 214,
    facebook: 'https://www.facebook.com/ragreendepot/',
    alias: "Also listed by MMSB as 'Robert's Arm Green Depot' (same address, phone and hours).",
  },
  'Gros Morne Green Depot': {
    id: 'gros-morne', town: 'Rocky Harbour', region: 'Western',
    pc: ['Gros Morne Recycling Depot', 'Rocky Harbour'],
    extraSources: [
      { url: 'https://rockyharbour.ca/residents/recycling-depot/', file: 'rockyharbour.ca_residents_recycling-depot_.html', what: "Town of Rocky Harbour 'Recycling Depot' guidelines and hours (hours match MMSB's Gros Morne listing)." },
    ],
    beerNo: {
      url: 'https://rockyharbour.ca/residents/recycling-depot/',
      quote: 'Beer bottles will no longer be accepted at the depot. They will be accepted at any local convenience store.',
    },
  },
  'Happy Valley–Goose Bay Green Depot': {
    id: 'happy-valley-goose-bay', town: 'Happy Valley-Goose Bay', region: 'Labrador', tz: AST,
    pc: ['Happy Valley Goose Bay Green Depot', 'Happy Valley-Goose Bay'], epra: 187,
  },
  'La Scie Green Depot': { id: 'la-scie', town: 'La Scie', region: 'Central' },
  'Labrador Straits Green Depot': {
    id: 'labrador-straits', town: "L'Anse au Loup", region: 'Labrador', tz: NST,
    pc: ['Labrador Straits Green Depot', "L'Anse Au Loup"], epra: 18689,
    facebook: 'https://www.facebook.com/p/Labrador-Straits-Green-Depot-100054623311649/',
  },
  'Labrador West Green Depot': { id: 'labrador-west', town: 'Wabush', region: 'Labrador', tz: AST, hoursNote: 'MMSB lists no hours for this depot; call to confirm.' },
  'Lewisporte Green Depot': {
    id: 'lewisporte', town: 'Lewisporte', region: 'Central',
    extraSources: [
      { url: 'https://www.lewisporte.ca/garbage-and-composting/', file: 'www.lewisporte.ca_garbage-and-composting_.html', what: 'Town of Lewisporte: Calypso Foundation depot hours and what is recyclable (beverage containers; paper & cardboard).' },
    ],
    paperYes: {
      url: 'https://www.lewisporte.ca/garbage-and-composting/',
      quote: 'What is recyclable? Beverage Containers (Please remove caps & straws. Rinse container and do not flatten or crush.) Paper & Cardboard Products (Must be clean & dry.) For further details contact the Calypso Foundation.',
    },
  },
  'Marystown Green Depot': { id: 'marystown', town: 'Marystown', region: 'Eastern', facebook: 'https://www.facebook.com/p/Marystown-Green-Depot-100063796260468/' },
  'Mount Pearl Green Depot': {
    id: 'mount-pearl', town: 'Mount Pearl', region: 'Avalon',
    website: 'https://scotiarecycling.com/depot-services/', pc: ['Mount Pearl Green Depot', 'Mount Pearl'], epra: 173, scotia: true,
    extraSources: [
      { url: 'https://www.mountpearl.ca/residents/garbage/what-can-i-recycle/', file: 'www.mountpearl.ca_residents_garbage_what-can-i-recycle_.html', what: 'City of Mount Pearl: glass beverage containers go to the Mount Pearl Green Depot, 5 Old Placentia Road.' },
    ],
  },
  'New Wes Valley Green Depot': { id: 'new-wes-valley', town: "Badger's Quay", region: 'Central', pc: ['New-Wes-Valley Green Depot', 'New-Wes-Valley'], epra: 17485 },
  'New World Island Green Depot': { id: 'new-world-island', town: 'New World Island', region: 'Central', facebook: 'https://www.facebook.com/p/Twillingate-New-World-Island-Green-Depot-Recycling-100063648992955/' },
  'Paradise Green Depot': {
    id: 'paradise', town: 'Paradise', region: 'Avalon',
    website: 'https://scotiarecycling.com/depot-services/', pc: ['Paradise Green Depot', 'Paradise'], epra: 180, scotia: true,
  },
  'Placentia Green Depot (Dunville)': { id: 'placentia', town: 'Placentia', region: 'Avalon', hoursNote: 'MMSB lists no hours for this depot; call to confirm.' },
  'Port Au Choix Green Depot': { id: 'port-au-choix', town: 'Port au Choix', region: 'Northern Peninsula', hoursNote: 'MMSB lists no phone or hours for this depot; call MMSB 1-800-901-6672.' },
  'Port Aux Basques Green Depot': {
    id: 'port-aux-basques', town: 'Port aux Basques', region: 'Western', epra: 179,
    facebook: 'https://www.facebook.com/portauxbasquesgreendepot/',
    extraSources: [
      { url: 'https://www.portauxbasques.ca/residents/waste-management/', file: 'www.portauxbasques.ca_residents_waste-management_.html', what: 'Town of Channel-Port aux Basques: EPRA drop-off centre at 14 Grand Bay West Road.' },
    ],
  },
  'Riverhead Green Depot': { id: 'riverhead', town: "St. Mary's", region: 'Avalon', pc: ['Riverhead Green Depot', 'Riverhead'] },
  'Roddickton Green Depot': { id: 'roddickton', town: 'Roddickton', region: 'Northern Peninsula' },
  'Sibley’s Cove Green Depot': { id: 'sibleys-cove', town: 'New Chelsea', region: 'Avalon' },
  'South Brook Green Depot': { id: 'south-brook', town: 'South Brook', region: 'Central' },
  'Springdale Green Depot': { id: 'springdale', town: 'Springdale', region: 'Central', epra: 20330 },
  'St. Anthony Green Depot': { id: 'st-anthony', town: 'St. Anthony', region: 'Northern Peninsula', hoursNote: 'MMSB lists no phone or hours; MMSB issued a request for proposals in 2026 for a new operator of a St. Anthony depot. Call MMSB 1-800-901-6672.' },
  'St. John’s – Torbay Road Green Depot': { id: 'st-johns-torbay-road', town: "St. John's", region: 'Avalon', website: 'https://www.greencan.ca/', facebook: 'https://www.facebook.com/evergreennl', evergreen: { electronics: false } },
  'St. John’s – Blackmarsh Road Green Depot': { id: 'st-johns-blackmarsh-road', town: "St. John's", region: 'Avalon', website: 'https://www.greencan.ca/', facebook: 'https://www.facebook.com/evergreennl', epra: 192, evergreen: { electronics: true } },
  'St. John’s – Cowan Avenue Green Depot': { id: 'st-johns-cowan-avenue', town: "St. John's", region: 'Avalon', website: 'https://www.greencan.ca/', facebook: 'https://www.facebook.com/evergreennl', evergreen: { electronics: false } },
  'St. John’s – Elizabeth Avenue Green Depot': { id: 'st-johns-elizabeth-avenue', town: "St. John's", region: 'Avalon', website: 'https://www.greencan.ca/', facebook: 'https://www.facebook.com/evergreennl', epra: 191, evergreen: { electronics: true } },
  'St. John’s – O’Leary Avenue Green Depot': { id: 'st-johns-oleary-avenue', town: "St. John's", region: 'Avalon' },
  'Stephenville Green Depot': {
    id: 'stephenville', town: 'Stephenville', region: 'Western',
    website: 'https://scotiarecycling.com/depot-services/', pc: ['Stephenville Green Depot', 'Stephenville'], epra: 174, scotia: true,
  },
  'Three Mile Rock Green Depot': { id: 'three-mile-rock', town: 'Three Mile Rock', region: 'Western' },
  'Twillingate Green Depot': { id: 'twillingate', town: 'Twillingate', region: 'Central', pc: ['Twillingate Green Depot', 'Twillingate'], epra: 167, facebook: 'https://www.facebook.com/p/Twillingate-New-World-Island-Green-Depot-Recycling-100063648992955/', phoneFrom: '709-884-2770', phoneNote: 'MMSB lists no phone; Product Care and EPRA both list 709-884-2770.' },
  // Green Depot affiliates (Labrador schools and organizations)
  'Amos Comenius Memorial School': { id: 'hopedale-amos-comenius-school', town: 'Hopedale', region: 'Labrador', tz: AST, type: 'affiliate' },
  'Bayside Academy': { id: 'port-hope-simpson-bayside-academy', town: 'Port Hope Simpson', region: 'Labrador', tz: AST, type: 'affiliate' },
  'Eagle River Development Corporation – Black Tickle': { id: 'black-tickle-erdc', town: 'Black Tickle', region: 'Labrador', tz: NST, type: 'affiliate' },
  'Eagle River Development Corporation – Cartwright': { id: 'cartwright-erdc', town: 'Cartwright', region: 'Labrador', tz: AST, type: 'affiliate' },
  'JC Ernhardt Memorial School': { id: 'makkovik-jc-erhardt-school', town: 'Makkovik', region: 'Labrador', tz: AST, type: 'affiliate' },
  'Jens Haven Memorial School': { id: 'nain-jens-haven-school', town: 'Nain', region: 'Labrador', tz: AST, type: 'affiliate' },
  'Mushuau Innu Natuashish School': { id: 'natuashish-mushuau-innu-school', town: 'Natuashish', region: 'Labrador', tz: AST, type: 'affiliate' },
  'Northern Lights Academy': { id: 'rigolet-northern-lights-academy', town: 'Rigolet', region: 'Labrador', tz: AST, type: 'affiliate' },
  'St. Lewis Academy': { id: 'st-lewis-academy', town: 'St. Lewis', region: 'Labrador', tz: AST, type: 'affiliate' },
};

// Listings deliberately dropped (recorded in the build report).
const dropped = {
  'Pasadena Green Depot': 'MMSB: "NOTICE: This location has closed."',
  'Robert’s Arm Green Depot': 'Duplicate of Green Bay South Green Depot (same address, phone, hours).',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAYS = { Mon: 'mon', Tues: 'tue', Tue: 'tue', Wed: 'wed', Thurs: 'thu', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

function to24(t) {
  // "8:30am" | "12:00pm" | "9:00 a.m." | "1:00-" (missing meridian handled by caller)
  const m = t.replace(/\./g, '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = m[2] || '00';
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mm}`;
}

function parseRange(s) {
  // "8:00am-12:00pm" / "1:00-4:00pm" / "9:00 a.m. – 5:00 p.m."
  const m = s.replace(/\./g, '').match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!m) return null;
  let a = m[1].trim(), b = m[2].trim();
  if (!/am|pm/i.test(a) && /pm/i.test(b)) {
    // "1:00-4:00pm" => start is pm as well when start hour < end hour and both < 12
    const ah = parseInt(a, 10);
    a += ah >= 1 && ah <= 6 ? 'pm' : 'am';
  }
  const A = to24(a), B = to24(b);
  return A && B ? `${A}-${B}` : null;
}

function parseHours(text, extraNote) {
  const hours = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null, note: null };
  const notes = [];
  for (const line of (text || '').split('\n')) {
    const m = line.trim().match(/^(Mon|Tues|Tue|Wed|Thurs|Thu|Fri|Sat|Sun)[a-z]*:\s*(.*)$/i);
    if (!m) continue;
    const day = DAYS[m[1]];
    let v = m[2].trim();
    // pull parenthetical / dash notices into the note
    const paren = v.match(/\(([^)]*)\)/g) || [];
    for (const p of paren) notes.push(`${m[1]}: ${p.slice(1, -1).trim()}`);
    v = v.replace(/\([^)]*\)/g, '').trim();
    const dash = v.match(/\s[–-]\s(?:closed|opening).*$/i);
    if (dash) { notes.push(`${m[1]}: ${dash[0].replace(/^\s[–-]\s/, '').trim()}`); v = v.slice(0, dash.index).trim(); }
    if (/^closed$/i.test(v)) { hours[day] = 'closed'; continue; }
    if (/appointment/i.test(v)) { hours[day] = null; notes.push(`${m[1]}: appointment only`); continue; }
    const ranges = v.split(/;|\s\/\s|&/).map(r => parseRange(r)).filter(Boolean);
    if (ranges.length) hours[day] = ranges.join(',');
    else { hours[day] = null; notes.push(`${m[1]}: "${v}" (could not parse)`); }
  }
  const all = [...notes, ...(extraNote ? [extraNote] : [])];
  hours.note = all.length ? [...new Set(all)].join(' | ') : null;
  return hours;
}

function normPhone(p) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return ten.length === 10 ? `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}` : p;
}

function htmlToText(html) {
  return html
    .replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h[1-6]>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8211;|&ndash;/g, '–').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function writeSource(id, name, url, what, body) {
  const dir = path.join(srcDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const header = `URL: ${url}\nFetched: ${FETCHED}\nWhat: ${what}\n${'-'.repeat(72)}\n`;
  fs.writeFileSync(path.join(dir, name), header + body.trim() + '\n');
}

function excerpt(text, needle, before = 200, after = 900) {
  const i = text.indexOf(needle);
  if (i < 0) return text.slice(0, 1500);
  return text.slice(Math.max(0, i - before), i + after);
}

const cite = (url, quote) => ({ url, fetched: FETCHED, quote });
const V = (verdict, c = null, note) => {
  const o = { verdict, cite: c };
  if (note) o.note = note;
  return o;
};

const MMSB_FAQ_URL = 'https://mmsb.nl.ca/faq/';
const MMSB_FAQ_QUOTE =
  'Refillable beer bottles are not part of MMSB’s Used Beverage Container Recycling Program because local beer brewers such as Labatt, Molson, and Quidi Vidi operate an independent deposit-refund system. As an added service for their customers, some Green Depot locations will accept refillable beer bottles. Please call your local depot to confirm whether refillable beer bottles are accepted as well as the amount of the refund.';

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const mmsbHtml = fs.readFileSync(path.join(raw, 'mmsb_green-depot.html'), 'utf8');
const mmsbText = htmlToText(mmsbHtml);
const scotiaText = htmlToText(fs.readFileSync(path.join(raw, 'scotia_depot-services.html'), 'utf8'));
const evergreenElectronics = htmlToText(fs.readFileSync(path.join(raw, 'greencan_electronics.html'), 'utf8'));
const evergreenFibre = htmlToText(fs.readFileSync(path.join(raw, 'greencan_fibre.html'), 'utf8'));
const evergreenStart = htmlToText(fs.readFileSync(path.join(raw, 'greencan_start.html'), 'utf8'));
const mmsbFaqText = htmlToText(fs.readFileSync(path.join(raw, 'mmsb_faq.html'), 'utf8'));

// remove stale per-depot dirs (everything except _raw) so the output is exact
for (const d of fs.readdirSync(srcDir)) {
  if (d !== '_raw' && fs.statSync(path.join(srcDir, d)).isDirectory()) fs.rmSync(path.join(srcDir, d), { recursive: true });
}

const rows = [];
const seen = new Set();
for (const m of mmsb) {
  if (dropped[m.name]) continue;
  const c = curated[m.name];
  if (!c) throw new Error(`No curated entry for MMSB listing: ${m.name}`);
  if (seen.has(c.id)) throw new Error(`duplicate id ${c.id}`);
  seen.add(c.id);

  const type = c.type || 'depot';
  const sources = [];
  const nextName = (mmsb[mmsb.indexOf(m) + 1] || {}).name;
  const mmsbBlockText = (() => {
    const t = mmsbText;
    const i = t.indexOf(m.name);
    if (i < 0) return t.slice(0, 1500);
    const j = nextName ? t.indexOf(nextName, i + m.name.length) : -1;
    return t.slice(i, j > 0 ? j : i + 1400);
  })();
  writeSource(c.id, 'mmsb-green-depot.txt', MMSB_URL, `MMSB "Find a Green Depot" listing for ${m.name} (name, address, phone, hours, description).`, mmsbBlockText);
  sources.push({ url: MMSB_URL, fetched: FETCHED, what: 'MMSB Green Depot listing: name, address, coordinates, phone, hours, description.' });

  // --- accepts -------------------------------------------------------------
  const desc = m.description || '';
  const accepts = {
    beverage: { verdict: 'yes', note: 'Every Green Depot takes beverage containers covered by MMSB’s deposit program.' },
    refillable_beer: V('unknown', null, 'Call to confirm. MMSB: some depots take refillable beer bottles as an added service; it is not part of the deposit program.'),
    iceberg_bottles: V('unknown', null, 'Call to confirm. Quidi Vidi runs its own return (store credit at the brewery); MMSB says only some depots take refillables.'),
    paper_cardboard: V('unknown', null, 'Call to confirm.'),
    paint: V('unknown', null, 'Call to confirm. Not on Product Care’s NL locator on the fetch date; absence is not a no.'),
    electronics: V('unknown', null, 'Call to confirm. Not on EPRA’s NL locator on the fetch date; absence is not a no.'),
  };
  if (type === 'affiliate') {
    accepts.beverage.note = 'MMSB lists this school or organization as a Green Depot affiliate accepting beverage containers.';
  }

  // MMSB description claims
  const mmsbSentence = (desc.match(/This depot also accepts [^.]*\./) || [])[0];
  if (mmsbSentence) {
    if (/paint/i.test(mmsbSentence)) accepts.paint = V('yes', cite(MMSB_URL, mmsbSentence));
    if (/electronic/i.test(mmsbSentence)) accepts.electronics = V('yes', cite(MMSB_URL, mmsbSentence));
  }
  const paperSentence = (desc.match(/[^.]*paper and cardboard[^.]*\./i) || [])[0];
  if (paperSentence) accepts.paper_cardboard = V('yes', cite(MMSB_URL, paperSentence.trim()), 'Limited amounts, residential customers.');

  // Product Care (paint)
  if (c.pc) {
    const hit = pc.find(p => p.title.replace(/&#8217;/g, '’') === c.pc[0] && p.address.city.trim() === c.pc[1]);
    if (!hit) throw new Error(`Product Care entry not found for ${c.id}: ${c.pc}`);
    const q = `${hit.title}, ${hit.address.address_line_1}, ${hit.address.city} — accepted products: ${hit.accepted_products.join(', ')}`;
    accepts.paint = V('yes', cite(PC_URL, q), hit.title !== m.name ? `Listed by Product Care as "${hit.title}".` : undefined);
    writeSource(c.id, 'productcare-locator.txt', PC_URL, 'Product Care Recycling NL paint drop-off locator entry (from the collection_sites JSON embedded in the page).', JSON.stringify(hit, null, 2));
    sources.push({ url: PC_URL, fetched: FETCHED, what: 'Product Care Recycling locator entry (paint).' });
  }

  // EPRA (electronics)
  if (c.epra) {
    const hit = epra.find(l => l.location_id === c.epra);
    if (!hit) throw new Error(`EPRA entry not found for ${c.id}: ${c.epra}`);
    const q = `${hit.name}, ${hit.address.address_1}, ${hit.address.city} — ${hit.category.name}`;
    accepts.electronics = V('yes', cite(EPRA_PAGE, q), hit.name !== m.name ? `Listed by EPRA as "${hit.name}".` : undefined);
    writeSource(c.id, 'epra-locator.txt', EPRA_PAGE, `EPRA / Recycle My Electronics NL drop-off locator entry. The page is a client-side app; this is the record it loads from ${EPRA_URL}`, JSON.stringify(hit, null, 2));
    sources.push({ url: EPRA_PAGE, fetched: FETCHED, what: 'EPRA Recycle My Electronics NL locator entry (electronics).' });
  }

  // Town electronics statement (Gander)
  if (c.townElectronicsQuote && accepts.electronics.verdict !== 'yes') {
    accepts.electronics = V('yes', cite(c.townElectronicsUrl, c.townElectronicsQuote));
  }

  // Scotia Recycling (four depots): fibre drop-off for residential customers, paint, electronics
  if (c.scotia) {
    const fibreQ = 'Fibre Drop-off Available for residential and commercial customers.';
    if (accepts.paper_cardboard.verdict !== 'yes') {
      accepts.paper_cardboard = V('yes', cite('https://scotiarecycling.com/depot-services/', fibreQ), 'Scotia lists fibre (paper and cardboard) drop-off for its four depots; MMSB’s current listing for this depot does not mention it, but MMSB’s ReThinkWasteNL tool (archived 2018-08-15) did: "Scotia Recycling will also accept limited amounts of paper and cardboard from residential customers." Confirm limits by phone.');
    }
    writeSource(c.id, 'scotiarecycling-depot-services.txt', 'https://scotiarecycling.com/depot-services/', 'Scotia Recycling depot services page: paint, electronics, fibre drop-off, the four depot addresses and phones.', scotiaText);
    sources.push({ url: 'https://scotiarecycling.com/depot-services/', fetched: FETCHED, what: 'Operator site (Scotia Recycling): services and locations.' });
  }

  // Ever Green Recycling (five depots)
  if (c.evergreen) {
    const eq = 'Ever Green Recycling is a drop off centre for your unwanted and old electronics at two of our locations: 79 Blackmarsh Road 92 Elizabeth Avenue';
    if (c.evergreen.electronics && accepts.electronics.verdict !== 'yes') accepts.electronics = V('yes', cite('https://www.greencan.ca/?page=electronics', eq));
    if (!c.evergreen.electronics) accepts.electronics = V('no', cite('https://www.greencan.ca/?page=electronics', eq), 'Ever Green takes electronics only at Blackmarsh Road and Elizabeth Avenue.');
    const fq = 'Paper, Newsprint & Cardboard (Commercial Only) ... Located at 79 Blackmarsh Road, Ever Green Commercial and Office Paper will receive and process the following materials, from commercial operators, and within a pre-arranged schedule';
    accepts.paper_cardboard = V('no', cite('https://www.greencan.ca/?page=fibre', fq), 'Commercial customers only, by arrangement at 79 Blackmarsh Road. Not a public drop-off.');
    writeSource(c.id, 'evergreen-electronics.txt', 'https://www.greencan.ca/?page=electronics', 'Ever Green Recycling electronics page.', evergreenElectronics);
    writeSource(c.id, 'evergreen-fibre.txt', 'https://www.greencan.ca/?page=fibre', 'Ever Green Recycling fibre (paper/cardboard) page: commercial only.', evergreenFibre);
    writeSource(c.id, 'evergreen-start-recycling.txt', 'https://www.greencan.ca/?page=start', 'Ever Green "Start Recycling" page: refund table incl. "Local and imported beer bottles: 5 cent refund" (does not say which bottles are taken back as refillables).', evergreenStart);
    sources.push({ url: 'https://www.greencan.ca/', fetched: FETCHED, what: 'Operator site (Ever Green Recycling): locations, electronics, fibre, refunds.' });
  }

  // Town / depot statements on beer bottles and paper
  if (c.beerNo) {
    accepts.refillable_beer = V('no', cite(c.beerNo.url, c.beerNo.quote), 'Town of Rocky Harbour depot guidelines. The page does not name brands.');
    accepts.iceberg_bottles = V('no', cite(c.beerNo.url, c.beerNo.quote), 'Same town statement; Iceberg bottles are refillable beer bottles. The page does not name brands.');
  }
  if (c.paperYes) accepts.paper_cardboard = V('yes', cite(c.paperYes.url, c.paperYes.quote), 'Saturday 1:00–5:00 pm per the town page. Confirm by phone.');

  // APCO Recycling (Grand Falls-Windsor): owner's statement recorded in PLAN.md
  if (c.apco) {
    const ownerUrl = 'docs/sources/grand-falls-windsor/owner-statement.txt';
    const ownerQuote = 'APCO Recycling (Grand Falls-Windsor) is Alexander’s own depot; its row is ground truth: Mon–Sat 10:00–4:30, closed 12:30–1:00, phone 709-489-1949, takes refillables and Iceberg bottles at 5¢.';
    accepts.refillable_beer = V('yes', cite(ownerUrl, ownerQuote), 'Refund 5¢ per bottle. Owner statement, 2026-09-13.');
    accepts.iceberg_bottles = V('yes', cite(ownerUrl, ownerQuote), 'Refund 5¢ per bottle. Owner statement, 2026-09-13.');
    writeSource(c.id, 'owner-statement.txt', 'PLAN.md (repo root), section "The brief (Alexander, 2026-09-13)"', 'Statement by the depot owner (Alexander Power, APCO Recycling), recorded in the build contract.', ownerQuote);
    sources.push({ url: ownerUrl, fetched: FETCHED, what: 'Owner statement (APCO Recycling), recorded in PLAN.md.' });
  }

  // extra sources -> files
  for (const s of c.extraSources || []) {
    const text = htmlToText(fs.readFileSync(path.join(raw, s.file), 'utf8'));
    writeSource(c.id, s.url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/_+$/, '') + '.txt', s.url, s.what, text);
    sources.push({ url: s.url, fetched: FETCHED, what: s.what });
  }

  // MMSB FAQ on refillables is the basis for every "unknown" on beer bottles
  if (accepts.refillable_beer.verdict === 'unknown') {
    writeSource(c.id, 'mmsb-faq-refillables.txt', MMSB_FAQ_URL, 'MMSB FAQ: why some Green Depots accept refillable beer bottles and others do not.', excerpt(mmsbFaqText, 'Why do some Green Depots accept refillable', 0, 1200));
    sources.push({ url: MMSB_FAQ_URL, fetched: FETCHED, what: 'MMSB FAQ on refillable beer bottles (basis for "unknown, call to confirm").' });
  }

  // --- hours / phone / address --------------------------------------------
  let hours;
  let hoursNote = c.hoursNote || null;
  const notice = (desc.match(/NOTICE[^]*$/i) || desc.match(/Notice:[^]*$/) || [])[0];
  if (type === 'affiliate') {
    hours = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null, note: 'Green Depot affiliate (school or organization). MMSB lists no hours; call ahead.' };
  } else if (type === 'mobile') {
    hours = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null, note: 'Mobile Xpress collection events run by Scotia Recycling; no fixed hours. ' + (desc.match(/The next mobile collection event[^]*?demand\./) || [''])[0].replace(/\n/g, ' ') };
  } else {
    hours = parseHours(m.hours, hoursNote);
  }
  if (c.apco) {
    // Owner's ground truth overrides the parsed MMSB hours (they agree; this makes the intent explicit).
    hours = { mon: '10:00-12:30,13:00-16:30', tue: '10:00-12:30,13:00-16:30', wed: '10:00-12:30,13:00-16:30', thu: '10:00-12:30,13:00-16:30', fri: '10:00-12:30,13:00-16:30', sat: '10:00-12:30,13:00-16:30', sun: 'closed', note: 'Closed 12:30–1:00 for lunch. Owner statement 2026-09-13; matches MMSB listing.' };
  }
  const tz = c.tz || NST;
  if (tz !== NST) hours.note = [hours.note, 'Atlantic time (America/Goose_Bay).'].filter(Boolean).join(' | ');

  let phone = normPhone(m.phone[0]);
  if (!phone && c.phoneFrom) phone = c.phoneFrom;
  if (c.apco) phone = '709-489-1949';

  const address = (m.address || '').split('\n').map(s => s.trim()).filter(Boolean).join(', ');

  // --- confidence ---------------------------------------------------------
  // verified: MMSB plus at least one independent non-program source (operator site,
  //           town page, owner) that corroborates the depot; partial: MMSB plus a
  //           program locator only; listing-only: MMSB only.
  const independent = sources.some(s => !/mmsb\.nl\.ca|productcare|recyclemyelectronics/.test(s.url));
  const program = sources.some(s => /productcare|recyclemyelectronics/.test(s.url));
  const confidence = independent ? 'verified' : program ? 'partial' : 'listing-only';

  const row = {
    id: c.id,
    name: m.name.replace(/–/g, '-'),
    type,
    town: c.town,
    region: c.region,
    address,
    lat: m.lat,
    lng: m.lng,
    tz,
    phone,
    website: c.website || null,
    facebook: c.facebook || null,
    hours,
    accepts,
    notice: notice ? notice.replace(/\n/g, ' ').trim() : null,
    sources,
    last_checked: FETCHED,
    confidence,
  };
  if (c.alias) row.alias_note = c.alias;
  if (c.phoneNote) row.phone_note = c.phoneNote;
  rows.push(row);
}

fs.writeFileSync(out, JSON.stringify(rows, null, 2) + '\n');
console.log(`wrote ${rows.length} rows to ${path.relative(root, out)}`);
console.log(`dropped: ${Object.keys(dropped).join('; ')}`);
