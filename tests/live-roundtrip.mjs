#!/usr/bin/env node
// Live round-trip against the real Corrections Worker (docs/API.md).
//   API=https://depot-finder.<acct>.workers.dev [ADMIN_PIN=...] [DEPOT_ID=apco-recycling] node tests/live-roundtrip.mjs
//   node tests/live-roundtrip.mjs --selftest   # proves the checks go red against a deliberately broken fake
// Checks: health, correction round-trip (201 + visible via GET /corrections when ADMIN_PIN given),
// 400 on bad shape, 401 on wrong PIN, stats count moved.
import http from 'node:http';

const selftest = process.argv.includes('--selftest');

async function run(api, { pin, depotId = 'apco-recycling', log = console.log } = {}) {
  const base = api.replace(/\/$/, '');
  const failures = [];
  const check = (name, cond, detail = '') => {
    log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    if (!cond) failures.push(name);
  };
  const j = async (path, init) => {
    const r = await fetch(base + path, init);
    let body = null;
    try { body = await r.json(); } catch {}
    return { status: r.status, body };
  };
  const post = (body) => j('/correction', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  const health = await j('/health');
  check('GET /health is ok:true', health.status === 200 && health.body?.ok === true, `status ${health.status} ${JSON.stringify(health.body)}`);

  const statsBefore = await j('/stats');
  check('GET /stats returns a count', statsBefore.status === 200 && Number.isInteger(statsBefore.body?.corrections), JSON.stringify(statsBefore.body));

  const stamp = new Date().toISOString();
  const ok = await post({ depot_id: depotId, field: 'other', proposed: `QA round-trip ${stamp}`, note: 'tests/live-roundtrip.mjs; safe to delete' });
  check('POST /correction valid → 201 {id}', ok.status === 201 && typeof ok.body?.id !== 'undefined' && ok.body.id !== null, `status ${ok.status} ${JSON.stringify(ok.body)}`);

  const bad = await post({ depot_id: depotId, field: 'not_a_field', proposed: 'x' });
  check('POST /correction unknown field → 400', bad.status === 400 && typeof bad.body?.error === 'string', `status ${bad.status}`);
  const bad2 = await post({ depot_id: 42 });
  check('POST /correction bad shape → 400', bad2.status === 400, `status ${bad2.status}`);

  const noPin = await j('/corrections');
  check('GET /corrections without PIN → 401', noPin.status === 401, `status ${noPin.status}`);
  const wrongPin = await j('/corrections', { headers: { authorization: 'Bearer definitely-wrong-' + stamp } });
  check('GET /corrections wrong PIN → 401', wrongPin.status === 401, `status ${wrongPin.status}`);

  if (pin) {
    const list = await j('/corrections', { headers: { authorization: `Bearer ${pin}` } });
    const found = Array.isArray(list.body) && list.body.some((c) => c.id === ok.body?.id || c.proposed === `QA round-trip ${stamp}`);
    check('GET /corrections with PIN lists the new row', list.status === 200 && found, `status ${list.status}, ${Array.isArray(list.body) ? list.body.length : '?'} rows`);
  } else {
    log('SKIP  GET /corrections with PIN — set ADMIN_PIN to verify the stored row');
  }

  const statsAfter = await j('/stats');
  check('GET /stats count moved by 1', statsAfter.body?.corrections === statsBefore.body?.corrections + 1, `${statsBefore.body?.corrections} → ${statsAfter.body?.corrections}`);
  check('GET /stats by_field counts "other"', Number.isInteger(statsAfter.body?.by_field?.other) && statsAfter.body.by_field.other >= 1, JSON.stringify(statsAfter.body?.by_field));

  return failures;
}

// ---- self-test: an in-process fake Worker, once correct and once with a planted defect ----
function fakeWorker({ defect } = {}) {
  const rows = [];
  const FIELDS = ['hours', 'phone', 'address', 'refillable_beer', 'iceberg_bottles', 'paper_cardboard', 'paint', 'electronics', 'other'];
  const PIN = 'selftest-pin';
  const server = http.createServer((req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, version: 'fake' });
    if (req.method === 'GET' && url.pathname === '/stats') {
      const by_field = {};
      for (const r of rows) by_field[r.field] = (by_field[r.field] || 0) + 1;
      return send(200, { corrections: rows.length, by_field });
    }
    if (req.method === 'GET' && url.pathname === '/corrections') {
      if (req.headers.authorization !== `Bearer ${PIN}`) return send(401, { error: 'unauthorized' });
      return send(200, rows);
    }
    if (req.method === 'POST' && url.pathname === '/correction') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        let b; try { b = JSON.parse(raw); } catch { return send(400, { error: 'bad json' }); }
        const shapeOk = typeof b.depot_id === 'string' && typeof b.proposed === 'string';
        const fieldOk = defect === 'no-field-whitelist' ? typeof b.field === 'string' : FIELDS.includes(b.field);
        if (!shapeOk || !fieldOk) return send(400, { error: 'bad shape' });
        const row = { id: rows.length + 1, ...b, created: Date.now() };
        rows.push(row);
        return send(201, { id: row.id });
      });
      return;
    }
    send(404, { error: 'not found' });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, api: `http://127.0.0.1:${server.address().port}`, pin: PIN })));
}

if (selftest) {
  console.log('== self-test 1/2: correct fake Worker — every check must PASS');
  const good = await fakeWorker();
  const f1 = await run(good.api, { pin: good.pin });
  good.server.close();
  console.log('\n== self-test 2/2: fake Worker with the field whitelist dropped — the 400 check must FAIL (negative control)');
  const bad = await fakeWorker({ defect: 'no-field-whitelist' });
  const f2 = await run(bad.api, { pin: bad.pin });
  bad.server.close();
  const wired = f1.length === 0 && f2.includes('POST /correction unknown field → 400'); // the stats-count check also reddens: the extra row got stored
  console.log(`\nself-test ${wired ? 'OK: the harness is wired up (green on correct, red on the planted defect)' : 'VOID: ' + JSON.stringify({ f1, f2 })}`);
  process.exit(wired ? 0 : 1);
} else {
  const api = process.env.API;
  if (!api) {
    console.error('usage: API=<worker base url> [ADMIN_PIN=...] [DEPOT_ID=...] node tests/live-roundtrip.mjs   |   --selftest');
    process.exit(2);
  }
  console.log(`live round-trip against ${api}`);
  const failures = await run(api, { pin: process.env.ADMIN_PIN, depotId: process.env.DEPOT_ID });
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nall checks passed');
  process.exit(failures.length ? 1 : 0);
}
