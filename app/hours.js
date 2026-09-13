// hours.js — "open now" for a depot row, computed in the depot's own time zone.
// Pure module: no DOM. Used by app.js in the browser and by hours.test.mjs under node --test.
//
// hours: { mon..sun: "10:00-16:30" | "10:00-12:30,13:00-16:30" | "closed" | null, note }
//   - a null day means hours unknown for that day
//   - a range whose end is before its start crosses midnight ("22:00-02:00")
//   - "00:00-24:00" is open all day
// tz: IANA zone. Default America/St_Johns. Labrador rows carry tz "America/Goose_Bay"
//   (or note text containing "Atlantic"), which is what the app passes in.

export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABEL = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
export const DEFAULT_TZ = 'America/St_Johns';
export const CLOSES_SOON_MINUTES = 60;

export function zoneFor(row) {
  if (row && row.tz) return row.tz;
  const note = row && row.hours && row.hours.note;
  if (note && /atlantic/i.test(note)) return 'America/Goose_Bay';
  return DEFAULT_TZ;
}

// Local wall-clock in tz: { day: 0..6 (Sun..Sat), minutes: 0..1439 }
export function localNow(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  const day = DAYS.indexOf(parts.weekday.toLowerCase().slice(0, 3));
  const hour = Number(parts.hour) % 24;
  return { day, minutes: hour * 60 + Number(parts.minute) };
}

export function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

// "10:00-12:30,13:00-16:30" -> [{start, end}] in minutes; end may exceed 1440 when it crosses midnight.
export function parseDay(spec) {
  if (spec == null) return null;                 // unknown
  const s = String(spec).trim().toLowerCase();
  if (s === '' || s === 'closed') return [];      // closed all day
  const out = [];
  for (const chunk of s.split(',')) {
    const [a, b] = chunk.split('-');
    const start = a != null ? parseTime(a) : null;
    const end = b != null ? parseTime(b) : null;
    if (start == null || end == null) return null; // unparseable -> unknown, never a guess
    out.push({ start, end: end <= start ? end + 1440 : end });
  }
  return out;
}

function fmtTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Intervals for a given weekday index, in minutes since that day's midnight,
// including the spill-over from the previous day's past-midnight range.
function intervalsOn(hours, dayIdx) {
  const today = parseDay(hours[DAYS[dayIdx]]);
  const yest = parseDay(hours[DAYS[(dayIdx + 6) % 7]]);
  const list = [];
  let unknown = today === null;
  if (yest) for (const r of yest) if (r.end > 1440) list.push({ start: 0, end: r.end - 1440 });
  if (today) for (const r of today) list.push(r);
  return { list, unknown };
}

// Returns { state: 'open'|'closes-soon'|'closed'|'unknown', text }
export function openStatus(hours, now = new Date(), tz = DEFAULT_TZ) {
  if (!hours) return { state: 'unknown', text: 'Hours unknown, call to confirm' };
  const { day, minutes } = localNow(now, tz);
  const { list, unknown } = intervalsOn(hours, day);
  const current = list.find((r) => minutes >= r.start && minutes < r.end);

  if (current) {
    const left = current.end - minutes;
    const closeText = `Closes ${fmtTime(current.end)}`;
    if (left <= CLOSES_SOON_MINUTES) return { state: 'closes-soon', text: `Closes soon, ${fmtTime(current.end)}` };
    return { state: 'open', text: closeText };
  }
  if (unknown) return { state: 'unknown', text: 'Hours unknown, call to confirm' };

  // Closed: find next opening within the next 7 days.
  const later = list.filter((r) => r.start > minutes).sort((a, b) => a.start - b.start)[0];
  if (later) return { state: 'closed', text: `Opens ${fmtTime(later.start)}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const spec = parseDay(hours[DAYS[d]]);
    if (spec === null) return { state: 'closed', text: 'Closed now, call to confirm when it opens' };
    if (spec.length) {
      const first = [...spec].sort((a, b) => a.start - b.start)[0];
      return { state: 'closed', text: `Opens ${i === 1 ? 'tomorrow' : DAY_LABEL[DAYS[d]]} ${fmtTime(first.start)}` };
    }
  }
  return { state: 'closed', text: 'Closed' };
}

// Human string for a hours table cell.
export function dayText(spec) {
  const p = parseDay(spec);
  if (p === null) return 'Unknown, call to confirm';
  if (p.length === 0) return 'Closed';
  return p.map((r) => `${fmtTime(r.start)}–${fmtTime(r.end)}`).join(', ');
}

export function todayKey(now = new Date(), tz = DEFAULT_TZ) {
  return DAYS[localNow(now, tz).day];
}
