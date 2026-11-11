# AURA Leads

Private owner dashboard for AURA Smart Homes. The AURA website's "Call me back" and
"Chat on WhatsApp" form posts each enquiry to `api/lead`, and this dashboard shows them live,
with charts, a lead list, one-tap Call / WhatsApp, and status / follow-up / notes / quote updates.

- `index.html`: the dashboard page (no build step).
- `api/lead.js`: public endpoint the website form posts to.
- `api/dash.js`: private endpoint for the dashboard (owner password, signed 30-day pass).
- `api/_lib.js`: storage (Upstash Redis over REST, no packages) and helpers.
- `SETUP.md`: the one-time setup in Vercel.
- Add `?demo` to the link to see made-up sample leads.

Needs on Vercel: an Upstash Redis database connected to the project (gives `KV_REST_API_URL`
and `KV_REST_API_TOKEN`) and a `DASHBOARD_PASSWORD` environment variable. Optional: `TEAM`.
No customer data is stored in this repository.
