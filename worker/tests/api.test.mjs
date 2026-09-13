// Depot Finder Worker API tests. Run: `npm test` inside worker/ (or `node --test tests/`).
//
// Boots `npx wrangler dev --port 6002` against the LOCAL D1 (applies migrations first),
// runs the suite, then kills it. Set API=http://host:port to test an already-running
// Worker instead. ADMIN_PIN is read from worker/.dev.vars unless the env var is set.
//
// Every assertion that matters goes through check(): it runs the assertion AND a
// negative control that must FAIL the same predicate. If the control also passes,
// the assertion is marked VOID and the test fails, because it measured nothing.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WORKER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 6002;
const API = (process.env.API || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const RUN_ID = `t${Date.now().toString(36)}`;

function readDevVar(name) {
  if (process.env[name]) return process.env[name];
  const f = path.join(WORKER_DIR, ".dev.vars");
  if (!existsSync(f)) return undefined;
  const m = readFileSync(f, "utf8").match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n]*)"?\\s*$`, "m"));
  return m?.[1];
}
const ADMIN_PIN = readDevVar("ADMIN_PIN");

let dev = null;
before(async () => {
  if (process.env.API) return; // external Worker under test
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local"], {
    cwd: WORKER_DIR, stdio: "ignore",
  });
  dev = spawn("npx", ["wrangler", "dev", "--port", String(PORT)], { cwd: WORKER_DIR, stdio: "ignore" });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${API}/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`wrangler dev did not answer on ${API} within 60s`);
});
after(() => { if (dev) dev.kill("SIGTERM"); });

// ---------- helpers ----------

// A distinct fake client IP per test so the rate guard is isolated per case and per run.
// Cloudflare overwrites CF-Connecting-IP at the edge; only the local dev server trusts ours.
let ipCounter = 0;
const ip = () => `203.0.113.${(++ipCounter) % 250}-${RUN_ID}`;

async function post(body, { ipAddr = ip(), raw = false, headers = {} } = {}) {
  const res = await fetch(`${API}/correction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ipAddr, ...headers },
    body: raw ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, headers: res.headers };
}
const good = (over = {}) => ({
  depot_id: `depot-${RUN_ID}`, field: "hours", proposed: "Mon–Sat 10:00–16:30", note: "test", ...over,
});

const results = [];
/**
 * check(name, predicate, subject, control):
 *   predicate(subject) must be true, predicate(control) must be false.
 *   If the control also satisfies the predicate the check is VOID (it cannot fail).
 */
function check(name, predicate, subject, control) {
  const pass = predicate(subject);
  const controlPasses = predicate(control);
  const status = controlPasses ? "VOID" : pass ? "PASS" : "FAIL";
  results.push({ name, status });
  assert.ok(!controlPasses, `${name}: VOID — negative control also passed (${JSON.stringify(control)})`);
  assert.ok(pass, `${name}: FAIL — got ${JSON.stringify(subject)}`);
}
after(() => {
  for (const r of results) console.log(`  [${r.status}] ${r.name}`);
});

// ---------- tests ----------

test("GET /health answers ok:true with a version", async () => {
  const res = await fetch(`${API}/health`);
  const body = await res.json();
  check("health ok", (b) => b?.ok === true && typeof b.version === "string", body, { ok: false });
  const miss = await fetch(`${API}/nope`);
  check("unknown route is 404", (s) => s === 404, miss.status, res.status);
});

test("POST /correction with a valid body is stored (201, id, visible to admin)", async () => {
  const r = await post(good({ contact: "someone@example.com" }));
  const bad = await post(good({ field: "bogus" }));
  check("valid correction -> 201", (x) => x.status === 201, r, bad);
  check("201 carries a uuid id", (x) => /^[0-9a-f-]{36}$/.test(x.json?.id || ""), r, bad);

  const admin = await fetch(`${API}/corrections`, { headers: { Authorization: `Bearer ${ADMIN_PIN}` } });
  assert.equal(admin.status, 200);
  const rows = await admin.json();
  const mine = rows.find((row) => row.id === r.json.id);
  check("stored row round-trips every field", (row) =>
    row && row.depot_id === `depot-${RUN_ID}` && row.field === "hours" &&
    row.proposed === "Mon–Sat 10:00–16:30" && row.note === "test" &&
    row.contact === "someone@example.com" && typeof row.created === "string",
    mine, rows.find((row) => row.id === "not-a-real-id"));
  check("ip_hash is never exposed to admin", (row) => row && !("ip_hash" in row), mine, undefined);
});

test("POST /correction rejects bad shapes with 400", async () => {
  const ok = await post(good());
  const cases = {
    "unknown field name": good({ field: "bogus" }),
    "missing depot_id": good({ depot_id: undefined }),
    "missing proposed": good({ proposed: undefined }),
    "empty proposed": good({ proposed: "   " }),
    "proposed over 500": good({ proposed: "x".repeat(501) }),
    "note over 500": good({ note: "x".repeat(501) }),
    "contact over 200": good({ contact: "x".repeat(201) }),
    "depot_id not a string": good({ depot_id: 42 }),
    "body is an array": [good()],
  };
  for (const [name, body] of Object.entries(cases)) {
    const r = await post(body);
    check(`400: ${name}`, (x) => x.status === 400 && typeof x.json?.error === "string", r, ok);
  }
  const notJson = await post("{not json", { raw: true });
  check("400: invalid JSON", (x) => x.status === 400, notJson, ok);
  const wrongMethod = await fetch(`${API}/correction`);
  check("405: GET /correction", (s) => s === 405, wrongMethod.status, ok.status);
});

test("every whitelisted field is accepted, and nothing else", async () => {
  const fields = ["hours", "phone", "address", "refillable_beer", "iceberg_bottles",
    "paper_cardboard", "paint", "electronics", "other"];
  const rejected = await post(good({ field: "Hours" })); // case matters
  for (const field of fields) {
    const r = await post(good({ field }));
    check(`field accepted: ${field}`, (x) => x.status === 201, r, rejected);
  }
});

test("GET /corrections needs the admin PIN (401 otherwise)", async () => {
  const none = await fetch(`${API}/corrections`);
  const wrong = await fetch(`${API}/corrections`, { headers: { Authorization: `Bearer ${ADMIN_PIN}x` } });
  const query = await fetch(`${API}/corrections?pin=${encodeURIComponent(ADMIN_PIN)}`);
  const right = await fetch(`${API}/corrections`, { headers: { Authorization: `Bearer ${ADMIN_PIN}` } });
  check("no PIN -> 401", (s) => s === 401, none.status, right.status);
  check("wrong PIN -> 401", (s) => s === 401, wrong.status, right.status);
  check("right PIN via ?pin= -> 200", (s) => s === 200, query.status, wrong.status);
  check("right PIN -> array", (b) => Array.isArray(b), await right.json(), await wrong.json());
});

test("rate guard: 61st correction from one IP inside an hour is 429", async () => {
  const one = ip();
  const other = ip();
  const statuses = [];
  for (let i = 0; i < 60; i++) statuses.push((await post(good({ field: "other" }), { ipAddr: one })).status);
  assert.deepEqual([...new Set(statuses)], [201], "first 60 must all be stored");
  const sixtyFirst = await post(good({ field: "other" }), { ipAddr: one });
  const fresh = await post(good({ field: "other" }), { ipAddr: other });
  check("61st from same IP -> 429", (x) => x.status === 429, sixtyFirst, fresh);
  check("429 sets Retry-After", (x) => x.headers.get("retry-after") !== null, sixtyFirst, fresh);
  check("other IP unaffected -> 201", (x) => x.status === 201, fresh, sixtyFirst);
});

test("GET /stats counts corrections overall and by field", async () => {
  const before = await (await fetch(`${API}/stats`)).json();
  await post(good({ field: "paint" }));
  await post(good({ field: "paint" }));
  await post(good({ field: "electronics" }));
  await post(good({ field: "bogus" })); // must not count
  const afterS = await (await fetch(`${API}/stats`)).json();
  check("stats shape", (s) => typeof s.corrections === "number" && s.by_field && typeof s.by_field === "object", afterS, {});
  check("total grew by exactly 3", (s) => s.corrections === before.corrections + 3, afterS, before);
  check("paint grew by 2", (s) => (s.by_field.paint || 0) === (before.by_field.paint || 0) + 2, afterS, before);
  check("electronics grew by 1", (s) => (s.by_field.electronics || 0) === (before.by_field.electronics || 0) + 1, afterS, before);
  check("rejected field did not count", (s) => (s.by_field.bogus || 0) === (before.by_field.bogus || 0), afterS, { by_field: { bogus: (before.by_field.bogus || 0) + 1 } });
});

test("CORS: app/localhost origins allowed, others get no ACAO", async () => {
  const local = await fetch(`${API}/health`, { headers: { Origin: "http://localhost:6001" } });
  const app = await fetch(`${API}/health`, { headers: { Origin: "https://depot-finder-app.example.workers.dev" } });
  const evil = await fetch(`${API}/health`, { headers: { Origin: "https://evil.example" } });
  const preflight = await fetch(`${API}/correction`, {
    method: "OPTIONS", headers: { Origin: "http://localhost:6001", "Access-Control-Request-Method": "POST" },
  });
  const acao = (r) => r.headers.get("access-control-allow-origin");
  check("localhost origin echoed", (r) => acao(r) === "http://localhost:6001", local, evil);
  check("depot-finder-app workers.dev origin echoed", (r) => acao(r) === "https://depot-finder-app.example.workers.dev", app, evil);
  check("foreign origin gets no ACAO", (r) => acao(r) === null, evil, local);
  check("preflight is 204 with methods", (r) => r.status === 204 && /POST/.test(r.headers.get("access-control-allow-methods") || ""), preflight, evil);
});
