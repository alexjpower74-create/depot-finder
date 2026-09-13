// app.js — Depot Finder customer app. Plain modules, no build.
import { openStatus, zoneFor, dayText, todayKey, DAYS } from './hours.js';
import { createMap } from './map.js';
import { DATA_PATHS } from './config.js';

const params = new URLSearchParams(location.search);
const MOCK = params.get('mock') === '1';

const VARIABLES = [
  { key: 'refillable_beer', short: 'Beer', yes: 'Takes refillable beer bottles.', no: 'Does not take refillable beer bottles.', name: 'Refillable beer bottles' },
  { key: 'iceberg_bottles', short: 'Iceberg', yes: 'Takes Quidi Vidi Iceberg blue bottles.', no: 'Does not take Quidi Vidi Iceberg blue bottles.', name: 'Iceberg blue bottles' },
  { key: 'paper_cardboard', short: 'Paper', yes: 'Takes paper and cardboard.', no: 'Does not take paper and cardboard.', name: 'Paper and cardboard' },
  { key: 'paint', short: 'Paint', yes: 'Takes paint.', no: 'Does not take paint.', name: 'Paint' },
  { key: 'electronics', short: 'Electronics', yes: 'Takes electronics.', no: 'Does not take electronics.', name: 'Electronics' },
];
const DAY_LABEL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const PILL = { open: 'Open now', 'closes-soon': 'Closes soon', closed: 'Closed', unknown: 'Hours unknown, call to confirm' };

const state = { depots: [], filters: new Set(), here: null, api: null, mapCtl: null };

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadData() {
  if (MOCK) {
    const { mockDepots } = await import('./data.mock.js');
    return mockDepots();
  }
  for (const p of DATA_PATHS) {
    try {
      const r = await fetch(p, { cache: 'no-cache' });
      if (r.ok) {
        const j = await r.json();
        const rows = Array.isArray(j) ? j : j.depots;
        if (Array.isArray(rows)) return rows;
      }
    } catch (e) { /* try the next path */ }
  }
  return null;
}

function verdictOf(d, key) {
  const v = d.accepts && d.accepts[key];
  return v && ['yes', 'no', 'unknown'].includes(v.verdict) ? v.verdict : 'unknown';
}
function status(d) { return openStatus(d.hours, new Date(), zoneFor(d)); }

function km(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function visibleDepots() {
  let rows = state.depots.filter((d) => {
    for (const f of state.filters) {
      if (f === 'open_now') { const s = status(d).state; if (s !== 'open' && s !== 'closes-soon') return false; }
      else if (verdictOf(d, f) !== 'yes') return false;
    }
    return true;
  });
  if (state.here) {
    rows = rows.map((d) => ({ d, dist: typeof d.lat === 'number' ? km(state.here, d) : Infinity }))
      .sort((a, b) => a.dist - b.dist).map((x) => Object.assign(x.d, { _dist: x.dist }));
  } else {
    rows = rows.slice().sort((a, b) => String(a.town).localeCompare(String(b.town)) || String(a.name).localeCompare(String(b.name)));
  }
  return rows;
}

function renderList() {
  const rows = visibleDepots();
  const list = $('#list');
  const tpl = $('#row-tpl');
  list.innerHTML = '';
  const total = state.depots.length;
  $('#list-count').textContent = rows.length === total ? `${total} depots` : `${rows.length} of ${total} depots`;
  $('#sort-note').textContent = state.here ? 'Sorted by distance from you' : (total ? 'Sorted by town' : '');
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No depots match these filters.';
    list.appendChild(li);
  }
  for (const d of rows) {
    const node = tpl.content.cloneNode(true);
    const a = $('.row-link', node);
    a.href = `#/depot/${encodeURIComponent(d.id)}`;
    a.dataset.id = d.id;
    const li = $('.row', node);
    li.dataset.depotId = d.id;
    li.dataset.testid = 'depot-row';
    $('.name', node).textContent = d.name;
    $('.town', node).textContent = d._dist != null && isFinite(d._dist) ? `${d.town} · ${d._dist < 10 ? d._dist.toFixed(1) : Math.round(d._dist)} km` : d.town;
    const s = status(d);
    const pill = $('.pill', node);
    pill.className = `pill ${s.state}`;
    pill.textContent = PILL[s.state];
    $('.next', node).textContent = s.state === 'unknown' ? '' : s.text;
    const vs = $('.verdicts', node);
    for (const v of VARIABLES) {
      const verdict = verdictOf(d, v.key);
      const span = document.createElement('span');
      span.className = `vchip ${verdict}`;
      span.dataset.var = v.key;
      span.dataset.verdict = verdict;
      span.textContent = v.short;
      span.title = verdict === 'yes' ? v.yes : verdict === 'no' ? v.no : `${v.name}: Unknown, call to confirm`;
      span.setAttribute('aria-label', span.title);
      vs.appendChild(span);
    }
    list.appendChild(node);
  }
  if (state.mapCtl) state.mapCtl.setDepots(rows, () => {});
}

function renderDepot(id) {
  const d = state.depots.find((x) => x.id === id);
  const body = $('#depot-body');
  if (!d) { body.innerHTML = '<p>We could not find that depot.</p>'; return; }
  const s = status(d);
  const tz = zoneFor(d);
  const today = todayKey(new Date(), tz);
  const hasCoords = typeof d.lat === 'number' && typeof d.lng === 'number';
  const dir = hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}` : null;

  const hoursRows = WEEK.map((k) => `<tr class="${k === today ? 'today' : ''}" data-day="${k}"><th scope="row">${DAY_LABEL[k]}</th><td>${esc(dayText(d.hours ? d.hours[k] : null))}</td></tr>`).join('');
  const verdicts = VARIABLES.map((v) => {
    const verdict = verdictOf(d, v.key);
    const c = d.accepts && d.accepts[v.key] && d.accepts[v.key].cite;
    let sentence = verdict === 'yes' ? v.yes : verdict === 'no' ? v.no : `${v.name}: Unknown, call to confirm.`;
    let source = '';
    if (verdict !== 'unknown') {
      source = c && (c.url || c.quote)
        ? `<details class="source"><summary>Source</summary>${c.quote ? `<blockquote>“${esc(c.quote)}”</blockquote>` : ''}${c.url ? `<a class="cite-link" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a>` : ''}${c.fetched ? `<div class="muted small">Fetched ${esc(c.fetched)}</div>` : ''}</details>`
        : `<div class="muted small" style="margin-left:22px">No source recorded for this answer.</div>`;
    }
    return `<li data-var="${v.key}" data-verdict="${verdict}"><div class="sentence"><span class="dot ${verdict}"></span><span class="text">${esc(sentence)}</span></div>${source}</li>`;
  }).join('');

  body.innerHTML = `
    <h1>${esc(d.name)}</h1>
    <span class="town muted">${esc(d.town)}${d.region ? `, ${esc(d.region)}` : ''}</span>
    <div class="depot-status"><span class="pill ${s.state}">${PILL[s.state]}</span>${s.state === 'unknown' ? '' : `<span class="muted">${esc(s.text)}</span>`}</div>
    <address>${esc(d.address || 'No street address on file.')}</address>
    <div class="actions">
      ${dir ? `<a class="btn primary" href="${dir}" target="_blank" rel="noopener">Directions</a>` : ''}
      ${d.phone ? `<a class="btn" href="tel:${esc(String(d.phone).replace(/[^\d+]/g, ''))}">Call ${esc(d.phone)}</a>` : '<span class="muted">No phone number on file.</span>'}
      ${d.website ? `<a class="btn" href="${esc(d.website)}" target="_blank" rel="noopener">Website</a>` : ''}
      ${d.facebook ? `<a class="btn" href="${esc(d.facebook)}" target="_blank" rel="noopener">Facebook</a>` : ''}
    </div>
    <h2>Hours</h2>
    <table class="hours"><tbody>${hoursRows}</tbody></table>
    ${d.hours && d.hours.note ? `<p class="note muted small">${esc(d.hours.note)}</p>` : ''}
    ${tz !== 'America/St_Johns' ? `<p class="muted small">Times shown in the depot's own zone (${esc(tz.replace('America/', '').replace('_', ' '))}).</p>` : ''}
    <h2>What this depot accepts</h2>
    <p class="standing-line">Every Green Depot takes beverage containers.</p>
    <ul class="verdict-list">${verdicts}</ul>
    <p class="muted small">Last checked: ${esc(d.last_checked || 'not recorded')}${d.confidence ? ` · ${esc({ verified: 'Verified', partial: 'Partly verified', 'listing-only': 'From a listing only' }[d.confidence] || d.confidence)}` : ''}</p>
    <form class="correction" id="correction-form">
      <h2>Suggest a correction</h2>
      <p class="muted small">Know something here is wrong or out of date? Tell us and we will check it.</p>
      <label for="c-field">What needs fixing</label>
      <select id="c-field" name="field" required>
        <option value="hours">Hours</option><option value="phone">Phone</option><option value="address">Address</option>
        <option value="refillable_beer">Refillable beer bottles</option><option value="iceberg_bottles">Iceberg bottles</option>
        <option value="paper_cardboard">Paper and cardboard</option><option value="paint">Paint</option>
        <option value="electronics">Electronics</option><option value="other">Something else</option>
      </select>
      <label for="c-proposed">What it should say</label>
      <textarea id="c-proposed" name="proposed" maxlength="500" required></textarea>
      <label for="c-note">How you know (optional)</label>
      <textarea id="c-note" name="note" maxlength="500"></textarea>
      <label for="c-contact">Your email or phone (optional)</label>
      <input id="c-contact" name="contact" maxlength="200" autocomplete="email">
      <button class="btn primary" type="submit">Send correction</button>
      <p class="form-msg" id="form-msg" aria-live="polite"></p>
    </form>`;

  $('#correction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('#form-msg');
    const btn = form.querySelector('button[type=submit]');
    const body = {
      depot_id: d.id,
      field: form.field.value,
      proposed: form.proposed.value.trim(),
    };
    if (form.note.value.trim()) body.note = form.note.value.trim();
    if (form.contact.value.trim()) body.contact = form.contact.value.trim();
    if (!body.proposed) { msg.className = 'form-msg err'; msg.textContent = 'Please say what it should say.'; return; }
    btn.disabled = true;
    msg.className = 'form-msg';
    msg.textContent = 'Sending…';
    try {
      const api = state.api || (state.api = await import(MOCK ? './api.mock.js' : './api.js'));
      const r = await api.postCorrection(body);
      msg.className = 'form-msg ok';
      msg.textContent = `Thank you. Your correction was received (reference ${r.id}).`;
      form.reset();
    } catch (err) {
      msg.className = 'form-msg err';
      msg.textContent = `Could not send: ${err.message}. You can also phone the depot directly.`;
    } finally { btn.disabled = false; }
  });
}

function route() {
  const m = /^#\/depot\/(.+)$/.exec(location.hash);
  const home = $('#home'), depot = $('#depot');
  if (m) {
    home.hidden = true; depot.hidden = false;
    renderDepot(decodeURIComponent(m[1]));
    window.scrollTo(0, 0);
  } else {
    depot.hidden = true; home.hidden = false;
    if (state.mapCtl) state.mapCtl.invalidate();
  }
}

function wireFilters() {
  $('#filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const key = chip.dataset.filter;
    const on = !state.filters.has(key);
    if (on) state.filters.add(key); else state.filters.delete(key);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    renderList();
  });
}

function wireLocate() {
  const btn = $('#locate');
  const apply = (lat, lng) => { state.here = { lat, lng }; btn.textContent = 'Sort by town'; renderList(); };
  btn.addEventListener('click', () => {
    if (state.here) { state.here = null; btn.textContent = 'Sort by distance'; renderList(); return; }
    if (!navigator.geolocation) { $('#sort-note').textContent = 'Location is not available on this device.'; return; }
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => { btn.disabled = false; apply(pos.coords.latitude, pos.coords.longitude); },
      () => { btn.disabled = false; $('#sort-note').textContent = 'Location not allowed, sorted by town.'; },
      { timeout: 8000, maximumAge: 300000 },
    );
  });
  // If the user already allowed location for this site, use it without asking again.
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((p) => {
      if (p.state === 'granted') navigator.geolocation.getCurrentPosition((pos) => apply(pos.coords.latitude, pos.coords.longitude), () => {});
    }).catch(() => {});
  }
}

async function main() {
  state.mapCtl = createMap($('#map'));
  wireFilters();
  wireLocate();
  const rows = await loadData();
  if (!rows) {
    $('#list-count').textContent = 'Depot data is not available yet.';
    $('#list').innerHTML = '<li class="empty">The depot list has not been published. Try again later.</li>';
    document.body.dataset.ready = 'error';
    return;
  }
  state.depots = rows;
  renderList();
  if (state.mapCtl) state.mapCtl.fitAll(rows);
  window.addEventListener('hashchange', route);
  route();
  document.body.dataset.ready = MOCK ? 'mock' : 'data';
  // Keep "open now" honest as the clock moves.
  setInterval(() => { if (!$('#home').hidden) renderList(); }, 60000);
}
main();
