# AURA Leads versions

Each version is saved as a branch `versions/vN`. To go back, ask Claude to "restore leads vN".

| Version | Date | What changed |
|---|---|---|
| v1 | 2026-11-11 | First AURA Leads dashboard: act-now panel, key numbers, charts, lead list, lead editing, owner password sign-in, new-lead chime |
| v2 | 2026-11-11 | Google Sheets removed. AURA Leads now stores enquiries itself (Upstash Redis on Vercel): the website form posts to api/lead, sign-in uses DASHBOARD_PASSWORD, plus Delete lead and Sign out on all devices |
