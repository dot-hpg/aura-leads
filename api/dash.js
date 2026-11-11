// Private: everything the owner dashboard does. Same-origin only.
const L = require("./_lib");

const EDITABLE = ["status", "priority", "followup", "notes", "assigned", "quote"];

module.exports = L.wrap(async (req, res) => {
  if (req.method === "GET") {
    // Setup check, shown on the sign-in screen. Reveals nothing about leads.
    let storage = false;
    try { await L.redis("PING"); storage = true; } catch (_) {}
    return L.send(res, 200, { ok: true, storage, password: !!L.PASSWORD });
  }
  if (req.method !== "POST") return L.send(res, 405, { ok: false, error: "Use POST" });
  const d = await L.readBody(req);
  const action = String(d.action || "");

  if (action === "login") {
    if (!L.PASSWORD) return L.send(res, 200, { ok: false, error: "No password yet. In Vercel, add DASHBOARD_PASSWORD under Settings → Environment Variables, then redeploy." });
    const fk = "rl:login:" + L.clientIp(req);
    const fails = Number(await L.redis("GET", fk) || 0);
    if (fails >= 8) return L.send(res, 429, { ok: false, error: "Too many wrong tries. Wait 15 minutes and try again." });
    await new Promise(r => setTimeout(r, 350));
    if (!L.passwordOk(d.password)) {
      await L.pipeline([["INCR", fk], ["EXPIRE", fk, "900"]]);
      return L.send(res, 200, { ok: false, error: "That password is not right." });
    }
    await L.redis("DEL", fk);
    const ms = d.remember ? 30 * 864e5 : 12 * 36e5;
    return L.send(res, 200, { ok: true, token: await L.makeToken(ms) });
  }

  if (!(await L.tokenOk(d.token))) return L.send(res, 401, { ok: false, auth: false, error: "Please sign in again." });

  if (action === "leads") {
    const leads = await L.allLeads();
    const team = (process.env.TEAM || "Aravind").split(",").map(s => s.trim()).filter(Boolean);
    return L.send(res, 200, { ok: true, now: new Date().toISOString(), leads, team });
  }

  if (action === "update") {
    const l = await L.getLead(String(d.ref || ""));
    if (!l) return L.send(res, 404, { ok: false, error: "Lead not found. It may have been deleted." });
    const f = d.fields || {}, oldStatus = l.status;
    EDITABLE.forEach(k => {
      if (!(k in f)) return;
      let v = f[k];
      if (k === "status") { if (!L.STATUSES.includes(v)) return; }
      else if (k === "priority") { if (v && !L.PRIORITIES.includes(v)) return; }
      else if (k === "followup") v = /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? new Date(v + "T00:00:00" + L.IST).toISOString() : "";
      else if (k === "quote") v = Math.max(0, Math.round(Number(String(v).replace(/[^\d.]/g, "")) || 0));
      else v = k === "notes" ? L.cleanLong(v, 3000) : L.clean(v, 80);
      l[k] = v;
    });
    // Suggest the next follow-up when the status moves on (unless a date was chosen).
    if (l.status !== oldStatus && !("followup" in f)) {
      const today = L.startOfDayIST();
      if (l.status === "won" || l.status === "lost") l.followup = "";
      else if (L.NEXT_FOLLOW_UP_DAYS[l.status] && (!l.followup || new Date(l.followup) <= today)) {
        let next = new Date(today.getTime() + L.NEXT_FOLLOW_UP_DAYS[l.status] * 864e5);
        if (l.status === "visitfixed" && l.visitDate && new Date(l.visitDate) >= today) next = new Date(l.visitDate);
        l.followup = next.toISOString();
      }
    }
    l.updated = new Date().toISOString();
    await L.putLead(l);
    return L.send(res, 200, { ok: true, lead: l });
  }

  if (action === "delete") {
    const ref = String(d.ref || "");
    await L.pipeline([["DEL", "lead:" + ref], ["ZREM", "leads", ref]]);
    return L.send(res, 200, { ok: true });
  }

  if (action === "signout-all") {
    await L.redis("DEL", "auth:key");
    return L.send(res, 200, { ok: true });
  }

  return L.send(res, 400, { ok: false, error: "Unknown action" });
});
