// Public: the AURA website's "Call me back" / "Chat on WhatsApp" form posts here.
const L = require("./_lib");

const ALLOWED = [/^https:\/\/aura-pnq6(-[a-z0-9-]+)?\.vercel\.app$/, /^https:\/\/sparkly-buttercream-f70f4e\.netlify\.app$/, /^https?:\/\/localhost(:\d+)?$/];

module.exports = L.wrap(async (req, res) => {
  const origin = req.headers.origin || "";
  // Any site may post (the form uses no-cors), but only known sites can read the answer.
  if (ALLOWED.some(r => r.test(origin))) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return L.send(res, 405, { ok: false, error: "Use POST" });

  // Simple flood guard: 30 enquiries per hour from one address.
  const ip = L.clientIp(req), rk = "rl:lead:" + ip;
  const [n] = await L.pipeline([["INCR", rk], ["EXPIRE", rk, "3600", "NX"]]);
  if (n > 30) return L.send(res, 429, { ok: false, error: "Too many enquiries. Please call us instead." });

  const d = await L.readBody(req);
  if (d.website || d.company_url) return L.send(res, 200, { ok: true }); // honeypot field from bots
  const name = L.clean(d.name, 80);
  const phone = String(d.phone || d.mobile || "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(-10);
  if (!name) return L.send(res, 400, { ok: false, error: "Name is missing" });
  if (!/^[6-9]\d{9}$/.test(phone)) return L.send(res, 400, { ok: false, error: "Mobile must be 10 digits" });

  const ref = (L.clean(d.id || d.ref, 40).replace(/[^A-Za-z0-9-]/g, "")) || ("AURA-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase());
  const wants = /whatsapp/i.test(d.prefer || "") ? "WhatsApp" : "Call back";

  // Same reference sent twice (visitor pressed both buttons): update, don't duplicate.
  const old = await L.getLead(ref);
  if (old) {
    if (old.wants.indexOf(wants) < 0) { old.wants = "Call back + WhatsApp"; await L.putLead(old); }
    return L.send(res, 200, { ok: true, ref, duplicate: true });
  }

  const visitDate = /^\d{4}-\d{2}-\d{2}$/.test(d.visitDate || "") ? new Date(d.visitDate + "T00:00:00" + L.IST).toISOString() : "";
  const now = new Date().toISOString();
  const lead = {
    ref, received: now, name, mobile: phone, wants,
    interests: L.clean(d.interests, 400), property: L.clean(d.property, 60), stage: L.clean(d.stage, 60), area: L.clean(d.area, 80),
    visitType: L.clean(d.visitType, 60), visitDate, visitTime: L.clean(d.visitTime, 60), custNote: L.cleanLong(d.note, 1000),
    device: L.clean(d.device, 30), page: L.clean(d.page, 300), referrer: L.clean(d.referrer || d.source, 300),
    status: "new", priority: "", followup: "", notes: "", assigned: "", quote: 0, updated: "", repeat: "", test: /^TEST-/.test(ref)
  };
  lead.priority = L.autoPriority(lead);
  const earlier = Number(await L.redis("INCR", "phone:" + phone)) - 1;
  if (earlier > 0) lead.repeat = ordinal(earlier + 1) + " enquiry";

  await L.pipeline([
    ["SET", "lead:" + ref, JSON.stringify(lead)],
    ["ZADD", "leads", String(Date.now()), ref]
  ]);
  return L.send(res, 200, { ok: true, ref });
});

function ordinal(n) { const t = ["th", "st", "nd", "rd"], v = n % 100; return n + (t[(v - 20) % 10] || t[v] || t[0]); }
