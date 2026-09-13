// Validates data/depots.json. Run with:  node --test data/validate.mjs
// Exits 1 on any failure (node --test sets the exit code).
//
// Checks: schema shape, unique ids, lat/lng inside NL's bounding box, every
// yes/no verdict carries a cite with url + quote, the APCO row matches the
// brief exactly, at least 40 depots.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DEPOTS_JSON || path.join(here, 'depots.json');
const depots = JSON.parse(fs.readFileSync(file, 'utf8'));

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const VARS = ['refillable_beer', 'iceberg_bottles', 'paper_cardboard', 'paint', 'electronics'];
const VERDICTS = new Set(['yes', 'no', 'unknown']);
const CONF = new Set(['verified', 'partial', 'listing-only']);
const TYPES = new Set(['depot', 'affiliate', 'mobile']);
const TZ = new Set(['America/St_Johns', 'America/Goose_Bay']);
// Newfoundland and Labrador bounding box (generous): lat 46.5–60.5, lng -67.9 to -52.5
const BBOX = { minLat: 46.5, maxLat: 60.5, minLng: -67.9, maxLng: -52.5 };
const HOURS_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d(,([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\d{3}-\d{3}-\d{4}$/;
const URL_RE = /^(https?:\/\/\S+|docs\/sources\/[a-z0-9-]+\/[a-z0-9._-]+)$/;

test('file is a non-empty array', () => {
  assert.ok(Array.isArray(depots), 'depots.json must be an array');
  assert.ok(depots.length > 0);
});

test('at least 40 depots (fixed-location depots, excluding affiliates and mobile events)', () => {
  const fixed = depots.filter(d => d.type === 'depot');
  assert.ok(fixed.length >= 40, `expected >= 40 fixed depots, found ${fixed.length}`);
});

test('ids are unique, kebab-case, and non-empty', () => {
  const ids = depots.map(d => d.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${id}`);
});

test('every row has the schema fields with the right types', () => {
  for (const d of depots) {
    const where = `row ${d.id}`;
    for (const k of ['id', 'name', 'town', 'region', 'address', 'last_checked', 'confidence', 'type', 'tz']) {
      assert.equal(typeof d[k], 'string', `${where}: ${k} must be a string`);
    }
    assert.ok(d.name.length > 0 && d.town.length > 0, `${where}: name/town empty`);
    assert.ok(TYPES.has(d.type), `${where}: type ${d.type}`);
    assert.ok(TZ.has(d.tz), `${where}: tz ${d.tz}`);
    assert.equal(typeof d.lat, 'number', `${where}: lat`);
    assert.equal(typeof d.lng, 'number', `${where}: lng`);
    assert.ok(d.phone === null || PHONE_RE.test(d.phone), `${where}: phone ${d.phone}`);
    assert.ok(d.website === null || /^https?:\/\//.test(d.website), `${where}: website`);
    assert.ok(d.facebook === null || /^https?:\/\//.test(d.facebook), `${where}: facebook`);
    assert.ok(CONF.has(d.confidence), `${where}: confidence ${d.confidence}`);
    assert.match(d.last_checked, DATE_RE, `${where}: last_checked`);
    assert.ok(Array.isArray(d.sources) && d.sources.length > 0, `${where}: sources`);
    for (const s of d.sources) {
      assert.match(s.url, URL_RE, `${where}: source url ${s.url}`);
      assert.match(s.fetched, DATE_RE, `${where}: source fetched`);
      assert.equal(typeof s.what, 'string', `${where}: source what`);
    }
    // hours
    assert.equal(typeof d.hours, 'object', `${where}: hours`);
    for (const day of DAYS) {
      const v = d.hours[day];
      assert.ok(v === null || v === 'closed' || HOURS_RE.test(v), `${where}: hours.${day} = ${v}`);
      if (v && v !== 'closed') {
        for (const r of v.split(',')) {
          const [a, b] = r.split('-');
          assert.ok(a < b, `${where}: hours.${day} range ${r} must open before it closes`);
        }
      }
    }
    assert.ok(d.hours.note === null || typeof d.hours.note === 'string', `${where}: hours.note`);
    // accepts
    assert.equal(d.accepts.beverage.verdict, 'yes', `${where}: beverage must be yes`);
    for (const v of VARS) {
      const a = d.accepts[v];
      assert.ok(a && VERDICTS.has(a.verdict), `${where}: accepts.${v}.verdict`);
      assert.ok('cite' in a, `${where}: accepts.${v}.cite missing`);
    }
  }
});

test('lat/lng inside the NL bounding box', () => {
  for (const d of depots) {
    assert.ok(d.lat >= BBOX.minLat && d.lat <= BBOX.maxLat, `${d.id}: lat ${d.lat}`);
    assert.ok(d.lng >= BBOX.minLng && d.lng <= BBOX.maxLng, `${d.id}: lng ${d.lng}`);
  }
});

test('every yes/no verdict has a cite with url, fetched date and a non-empty quote; unknown has none', () => {
  for (const d of depots) {
    for (const v of VARS) {
      const a = d.accepts[v];
      if (a.verdict === 'unknown') {
        assert.equal(a.cite, null, `${d.id}: ${v} is unknown but carries a cite`);
        continue;
      }
      assert.ok(a.cite && typeof a.cite === 'object', `${d.id}: ${v} is ${a.verdict} without a cite`);
      assert.match(a.cite.url, URL_RE, `${d.id}: ${v} cite url ${a.cite.url}`);
      assert.match(a.cite.fetched, DATE_RE, `${d.id}: ${v} cite fetched`);
      assert.ok(typeof a.cite.quote === 'string' && a.cite.quote.trim().length >= 10, `${d.id}: ${v} cite quote too short`);
    }
  }
});

test('every cite url is also listed in the row sources and has a saved copy under docs/sources/<id>/', () => {
  const root = path.resolve(here, '..');
  for (const d of depots) {
    const dir = path.join(root, 'docs', 'sources', d.id);
    assert.ok(fs.existsSync(dir), `${d.id}: docs/sources/${d.id}/ missing`);
    const files = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const v of VARS) {
      const a = d.accepts[v];
      if (!a.cite) continue;
      const u = a.cite.url;
      assert.ok(d.sources.some(s => s.url === u || (u.startsWith(s.url.replace(/\/$/, '')) && /greencan|scotia|productcare|recyclemyelectronics/.test(u))), `${d.id}: ${v} cite url not in sources: ${u}`);
      assert.ok(files.some(t => t.includes(`URL: ${u}`) || (u.startsWith('docs/sources/') && fs.existsSync(path.join(root, u)))), `${d.id}: no saved source text for ${u}`);
    }
  }
});

test('APCO Recycling (Grand Falls-Windsor) row matches the brief exactly', () => {
  const apco = depots.find(d => d.id === 'grand-falls-windsor');
  assert.ok(apco, 'grand-falls-windsor row missing');
  assert.equal(apco.name, 'APCO Recycling (Grand Falls-Windsor Green Depot)');
  assert.match(apco.alias_note || '', /Grand Falls-Windsor Green Depot/);
  assert.equal(apco.phone, '709-489-1949');
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
    assert.equal(apco.hours[day], '10:00-12:30,13:00-16:30', `apco hours.${day}`);
  }
  assert.equal(apco.hours.sun, 'closed');
  assert.equal(apco.accepts.refillable_beer.verdict, 'yes');
  assert.equal(apco.accepts.iceberg_bottles.verdict, 'yes');
  assert.match(apco.accepts.refillable_beer.note || '', /5¢/);
  assert.match(apco.accepts.iceberg_bottles.note || '', /5¢/);
  assert.equal(apco.tz, 'America/St_Johns');
});

test('no row claims a blanket acceptance beyond beverage containers', () => {
  const banned = /(all|every) (green )?depots? (accept|take)s? (?!beverage)/i;
  for (const d of depots) {
    const text = JSON.stringify(d);
    assert.ok(!banned.test(text), `${d.id}: contains a blanket acceptance claim`);
  }
});

test('Labrador rows carry the Atlantic zone except the Labrador Straits and Black Tickle', () => {
  for (const d of depots.filter(d => d.region === 'Labrador')) {
    const nst = ['labrador-straits', 'black-tickle-erdc'].includes(d.id);
    assert.equal(d.tz, nst ? 'America/St_Johns' : 'America/Goose_Bay', `${d.id}: tz`);
  }
  for (const d of depots.filter(d => d.region !== 'Labrador')) assert.equal(d.tz, 'America/St_Johns', `${d.id}: tz`);
});
