// Depot Finder corrections Worker. Contract: docs/API.md.
//
//   GET  /health              -> { ok: true, version }
//   POST /correction          -> 201 { id } | 400 { error } | 429 { error }
//   GET  /corrections         -> [ ... ]   (Authorization: Bearer <ADMIN_PIN> or ?pin=)
//   GET  /stats               -> { corrections, by_field }
//
// Storage: D1 binding DB (shared bottle-count database), table df_corrections.

export const FIELDS = Object.freeze([
  "hours", "phone", "address",
  "refillable_beer", "iceberg_bottles", "paper_cardboard", "paint", "electronics",
  "other",
]);

const LIMITS = Object.freeze({ depot_id: 100, proposed: 500, note: 500, contact: 200 });
const RATE_LIMIT = 60;                 // corrections per IP ...
const RATE_WINDOW_MS = 60 * 60 * 1000; // ... per hour

// ---------- CORS ----------

function originAllowed(origin, env) {
  if (!origin) return false;
  let url;
  try { url = new URL(origin); } catch { return false; }
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (/^depot-finder[a-z0-9-]*\..*\.workers\.dev$/i.test(host)) return true;
  const extra = String(env.APP_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const h = { "Vary": "Origin" };
  if (originAllowed(origin, env)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

// ---------- validation ----------

// Returns { ok: true, value } or { ok: false, error }.
export function validateCorrection(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const str = (key, { required, max }) => {
    const v = body[key];
    if (v === undefined || v === null) {
      if (required) return { error: `${key} is required` };
      return { value: null };
    }
    if (typeof v !== "string") return { error: `${key} must be a string` };
    const t = v.trim();
    if (required && !t) return { error: `${key} must not be empty` };
    if (t.length > max) return { error: `${key} must be at most ${max} characters` };
    return { value: t || null };
  };

  const depot_id = str("depot_id", { required: true, max: LIMITS.depot_id });
  if (depot_id.error) return { ok: false, error: depot_id.error };

  if (typeof body.field !== "string") return { ok: false, error: "field is required" };
  if (!FIELDS.includes(body.field)) {
    return { ok: false, error: `field must be one of: ${FIELDS.join(", ")}` };
  }

  const proposed = str("proposed", { required: true, max: LIMITS.proposed });
  if (proposed.error) return { ok: false, error: proposed.error };
  const note = str("note", { required: false, max: LIMITS.note });
  if (note.error) return { ok: false, error: note.error };
  const contact = str("contact", { required: false, max: LIMITS.contact });
  if (contact.error) return { ok: false, error: contact.error };

  return {
    ok: true,
    value: {
      depot_id: depot_id.value,
      field: body.field,
      proposed: proposed.value,
      note: note.value,
      contact: contact.value,
    },
  };
}

// ---------- helpers ----------

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(request) {
  // Cloudflare sets CF-Connecting-IP on the edge and overwrites anything the client sent.
  return request.headers.get("CF-Connecting-IP")
    || (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim()
    || "unknown";
}

function adminOk(request, url, env) {
  const pin = env.ADMIN_PIN;
  if (!pin) return false;
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const given = bearer || url.searchParams.get("pin") || "";
  return given.length > 0 && timingSafeEqual(given, pin);
}

function timingSafeEqual(a, b) {
  const A = new TextEncoder().encode(a);
  const B = new TextEncoder().encode(b);
  let diff = A.length ^ B.length;
  for (let i = 0; i < Math.max(A.length, B.length); i++) diff |= (A[i] ?? 0) ^ (B[i] ?? 0);
  return diff === 0;
}

// ---------- routes ----------

async function postCorrection(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "body must be valid JSON" }, 400); }
  const v = validateCorrection(body);
  if (!v.ok) return json({ error: v.error }, 400);

  const ip_hash = await sha256Hex(`${clientIp(request)}|${env.IP_SALT || "depot-finder"}`);
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM df_corrections WHERE ip_hash = ?1 AND created > ?2",
  ).bind(ip_hash, since).first("n");
  if (Number(recent) >= RATE_LIMIT) {
    return json({ error: `rate limit: at most ${RATE_LIMIT} corrections per hour` }, 429, { "Retry-After": "3600" });
  }

  const id = crypto.randomUUID();
  const created = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO df_corrections (id, depot_id, field, proposed, note, contact, created, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
  ).bind(id, v.value.depot_id, v.value.field, v.value.proposed, v.value.note, v.value.contact, created, ip_hash).run();
  return json({ id }, 201);
}

async function getCorrections(request, url, env) {
  if (!adminOk(request, url, env)) return json({ error: "unauthorized" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT id, depot_id, field, proposed, note, contact, created FROM df_corrections ORDER BY created DESC LIMIT 1000",
  ).all();
  return json(results, 200);
}

async function getStats(env) {
  const { results } = await env.DB.prepare(
    "SELECT field, COUNT(*) AS n FROM df_corrections GROUP BY field",
  ).all();
  const by_field = {};
  let corrections = 0;
  for (const row of results) { by_field[row.field] = Number(row.n); corrections += Number(row.n); }
  return json({ corrections, by_field }, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    const withCors = (res) => {
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (request.method === "GET" && path === "/health") {
        return withCors(json({ ok: true, version: env.VERSION || "dev" }, 200));
      }
      if (request.method === "POST" && path === "/correction") return withCors(await postCorrection(request, env));
      if (request.method === "GET" && path === "/corrections") return withCors(await getCorrections(request, url, env));
      if (request.method === "GET" && path === "/stats") return withCors(await getStats(env));
      if (["/health", "/correction", "/corrections", "/stats"].includes(path)) {
        return withCors(json({ error: "method not allowed" }, 405));
      }
      return withCors(json({ error: "not found" }, 404));
    } catch (err) {
      console.error("depot-finder worker error", err);
      return withCors(json({ error: "internal error" }, 500));
    }
  },
};
