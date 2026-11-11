// Shared helpers for the AURA Leads API (Vercel serverless functions, no packages needed).
// Storage: Upstash Redis, connected from the Vercel project's Storage tab.
const crypto = require("crypto");

const REDIS_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const PASSWORD = process.env.DASHBOARD_PASSWORD || "";

const STATUSES = ["new", "called", "visitfixed", "visited", "quotesent", "negotiating", "won", "lost", "noresponse"];
const PRIORITIES = ["hot", "warm", "cold"];
const NEXT_FOLLOW_UP_DAYS = { called: 2, visitfixed: 1, visited: 1, quotesent: 3, negotiating: 2, noresponse: 3 };
const IST = "+05:30";

/* ---------- Redis (REST) ---------- */
async function redis(...cmd) {
  const [r] = await pipeline([cmd]);
  return r;
}
async function pipeline(cmds) {
  if (!REDIS_URL || !REDIS_TOKEN) throw httpError(503, "Lead storage is not connected yet. In Vercel, open this project's Storage tab and connect an Upstash Redis database, then redeploy.");
  const r = await fetch(REDIS_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds.map(c => c.map(String)))
  });
  if (!r.ok) throw httpError(502, "Lead storage did not answer (" + r.status + ").");
  const out = await r.json();
  return out.map(x => { if (x.error) throw httpError(502, "Storage error: " + x.error); return x.result; });
}

/* ---------- HTTP ---------- */
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  let b = req.body;
  if (b === undefined) {
    b = await new Promise((resolve) => { let s = ""; req.on("data", c => { s += c; if (s.length > 50000) req.destroy(); }); req.on("end", () => resolve(s)); req.on("error", () => resolve("")); });
  }
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") { try { b = b ? JSON.parse(b) : {}; } catch (_) { b = {}; } }
  return b && typeof b === "object" ? b : {};
}
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (err) { send(res, err.status || 500, { ok: false, error: err.status ? err.message : "Something went wrong. Please try again." }); if (!err.status) console.error(err); }
  };
}
function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim(); }

/* ---------- Auth ---------- */
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
async function signingKey() {
  let k = await redis("GET", "auth:key");
  if (!k) { k = crypto.randomBytes(32).toString("hex"); await redis("SET", "auth:key", k); }
  return k + sha(PASSWORD); // changing the password signs everyone out
}
function hmac(key, s) { return crypto.createHmac("sha256", key).update(s).digest("base64url"); }
async function makeToken(ms) { const exp = String(Date.now() + ms); return exp + "." + hmac(await signingKey(), exp); }
async function tokenOk(t) {
  const [exp, sig] = String(t || "").split(".");
  if (!/^\d+$/.test(exp || "") || Number(exp) < Date.now() || !sig) return false;
  const good = hmac(await signingKey(), exp);
  return good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}
function passwordOk(pw) {
  if (!PASSWORD) return false;
  const a = Buffer.from(sha(String(pw || ""))), b = Buffer.from(sha(PASSWORD));
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Leads ---------- */
function clean(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 300); }
function cleanLong(v, max) { return String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, max || 2000); }
function startOfDayIST(d = new Date()) {
  const s = new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
  return new Date(s + "T00:00:00" + IST);
}
function autoPriority(l) {
  const count = l.interests ? l.interests.split(",").filter(s => s.trim()).length : 0;
  const soon = l.visitDate && (new Date(l.visitDate) - Date.now()) < 8 * 864e5;
  return soon || count >= 3 || /full home/i.test(l.interests) || /villa|office|hotel/i.test(l.property) ? "hot" : "warm";
}
async function getLead(ref) { const s = await redis("GET", "lead:" + ref); return s ? JSON.parse(s) : null; }
async function putLead(l) { await redis("SET", "lead:" + l.ref, JSON.stringify(l)); }
async function allLeads() {
  const refs = await redis("ZRANGE", "leads", "0", "-1");
  if (!refs || !refs.length) return [];
  const out = [];
  for (let i = 0; i < refs.length; i += 500) {
    const vals = await redis("MGET", ...refs.slice(i, i + 500).map(r => "lead:" + r));
    vals.forEach(v => { if (v) out.push(JSON.parse(v)); });
  }
  return out;
}

module.exports = {
  redis, pipeline, send, readBody, wrap, httpError, clientIp, makeToken, tokenOk, passwordOk,
  clean, cleanLong, startOfDayIST, autoPriority, getLead, putLead, allLeads,
  STATUSES, PRIORITIES, NEXT_FOLLOW_UP_DAYS, IST, PASSWORD, REDIS_URL, REDIS_TOKEN
};
