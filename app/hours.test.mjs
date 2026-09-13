import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStatus, parseDay, dayText, zoneFor, localNow, todayKey } from './hours.js';

// Helper: a UTC instant that is `hh:mm` on a given weekday in `tz`.
// 2026-09-14 is a Monday. NDT = UTC-2:30, ADT (Goose Bay) = UTC-3.
const NL = 'America/St_Johns';
const LAB = 'America/Goose_Bay';
function at(isoUtc) { return new Date(isoUtc); }

const apco = { mon: '10:00-12:30,13:00-16:30', tue: '10:00-12:30,13:00-16:30', wed: '10:00-12:30,13:00-16:30',
  thu: '10:00-12:30,13:00-16:30', fri: '10:00-12:30,13:00-16:30', sat: '10:00-12:30,13:00-16:30', sun: 'closed' };

test('localNow converts to St. Johns wall clock (NDT, UTC-2:30)', () => {
  // 13:30Z Monday -> 11:00 NDT Monday
  assert.deepEqual(localNow(at('2026-09-14T13:30:00Z'), NL), { day: 1, minutes: 11 * 60 });
  // 02:00Z Tuesday -> 23:30 NDT Monday (day rolls back)
  assert.deepEqual(localNow(at('2026-09-15T02:00:00Z'), NL), { day: 1, minutes: 23 * 60 + 30 });
});

test('open in the morning, closes text', () => {
  const s = openStatus(apco, at('2026-09-14T13:30:00Z'), NL); // 11:00 Mon
  assert.equal(s.state, 'open');
  assert.equal(s.text, 'Closes 12:30');
});

test('split lunch closure: closed 12:30-13:00, opens 13:00', () => {
  const s = openStatus(apco, at('2026-09-14T15:15:00Z'), NL); // 12:45 Mon
  assert.equal(s.state, 'closed');
  assert.equal(s.text, 'Opens 13:00');
});

test('closes soon within 60 minutes of closing', () => {
  const s = openStatus(apco, at('2026-09-14T18:45:00Z'), NL); // 16:15 Mon
  assert.equal(s.state, 'closes-soon');
  assert.equal(s.text, 'Closes soon, 16:30');
});

test('after close: opens tomorrow', () => {
  const s = openStatus(apco, at('2026-09-14T20:00:00Z'), NL); // 17:30 Mon
  assert.equal(s.state, 'closed');
  assert.equal(s.text, 'Opens tomorrow 10:00');
});

test('Saturday evening skips closed Sunday: Opens Mon 10:00', () => {
  const s = openStatus(apco, at('2026-09-19T20:00:00Z'), NL); // 17:30 Sat
  assert.equal(s.state, 'closed');
  assert.equal(s.text, 'Opens Mon 10:00');
});

test('Labrador row on Atlantic time: same instant, different verdict', () => {
  const lab = { ...apco, note: 'Atlantic time' };
  // 12:45Z Monday = 10:15 NDT (open) but 09:45 ADT (still closed)
  assert.equal(zoneFor({ hours: lab }), LAB);
  assert.equal(zoneFor({ tz: 'America/Goose_Bay', hours: apco }), LAB);
  assert.equal(zoneFor({ hours: apco }), NL);
  assert.equal(openStatus(apco, at('2026-09-14T12:45:00Z'), NL).state, 'open');
  const s = openStatus(lab, at('2026-09-14T12:45:00Z'), zoneFor({ hours: lab }));
  assert.equal(s.state, 'closed');
  assert.equal(s.text, 'Opens 10:00');
});

test('midnight crossing: 22:00-02:00 is open at 01:00 next day', () => {
  const late = { ...apco, fri: '22:00-02:00', sat: 'closed' };
  // 03:30Z Saturday = 01:00 NDT Saturday
  const s = openStatus(late, at('2026-09-19T03:30:00Z'), NL);
  assert.equal(s.state, 'closes-soon');
  assert.equal(s.text, 'Closes soon, 02:00');
  // 03:00 NDT Saturday -> closed, next opening Mon 10:00
  assert.equal(openStatus(late, at('2026-09-19T05:30:00Z'), NL).text, 'Opens Mon 10:00');
});

test('00:00-24:00 is open all day', () => {
  const allDay = { ...apco, mon: '00:00-24:00' };
  assert.equal(openStatus(allDay, at('2026-09-14T02:31:00Z'), NL).state, 'open'); // 00:01 Mon
  assert.equal(openStatus(allDay, at('2026-09-14T13:30:00Z'), NL).state, 'open');
});

test('unknown day is unknown, never a guess', () => {
  const u = { ...apco, mon: null };
  const s = openStatus(u, at('2026-09-14T13:30:00Z'), NL);
  assert.equal(s.state, 'unknown');
  assert.match(s.text, /call to confirm/);
  assert.equal(openStatus(null).state, 'unknown');
  assert.equal(openStatus({ ...apco, mon: 'noon-ish' }, at('2026-09-14T13:30:00Z'), NL).state, 'unknown');
});

test('parseDay and dayText', () => {
  assert.deepEqual(parseDay('closed'), []);
  assert.equal(parseDay(null), null);
  assert.deepEqual(parseDay('10:00-12:30,13:00-16:30'), [{ start: 600, end: 750 }, { start: 780, end: 990 }]);
  assert.deepEqual(parseDay('22:00-02:00'), [{ start: 1320, end: 1560 }]);
  assert.equal(dayText('10:00-12:30,13:00-16:30'), '10:00–12:30, 13:00–16:30');
  assert.equal(dayText(null), 'Unknown, call to confirm');
  assert.equal(dayText('closed'), 'Closed');
  assert.equal(todayKey(at('2026-09-14T13:30:00Z'), NL), 'mon');
});
