# AURA Leads

Private owner dashboard for AURA Smart Homes. It shows every "Call me back" and
WhatsApp enquiry from the website (aura-pnq6.vercel.app) live, with charts, a lead
list, one-tap Call / WhatsApp, and updates that save back to the AURA Enquiries
Google Sheet.

- `index.html`: the whole dashboard (no build step). Deploy the repo root on Vercel.
- `sheet-script/Code.gs`: the Google Sheet's Apps Script, including the private data link the dashboard uses.
- `SETUP.md`: the one-time setup steps.
- Add `?demo` to the link to see made-up sample leads.

No customer data is stored in this repository. Leads stay in the Google Sheet and are
only returned after signing in with the owner password.
