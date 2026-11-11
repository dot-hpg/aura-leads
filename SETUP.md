# AURA Leads: switch it on (about 3 minutes, once)

Every "Call me back" and "Chat on WhatsApp" enquiry from the AURA website now goes
straight into AURA Leads. No Google Sheet is involved any more.

Do these in **vercel.com → your aura-leads project**.

## 1. Connect the lead storage (1 minute, free)
1. Open the **Storage** tab and click **Create Database**.
2. Pick **Upstash for Redis** (it may be called "Redis" or "Upstash"), choose the **Free** plan, and click **Create**.
3. When it asks which projects to connect, keep **aura-leads** ticked and click **Connect**.

## 2. Set your password (1 minute)
1. Open **Settings → Environment Variables**.
2. Key: `DASHBOARD_PASSWORD`. Value: a password only you know (at least 8 characters).
3. Click **Save**.

## 3. Switch it on
1. Open the **Deployments** tab. On the top deployment, click **⋯ → Redeploy → Redeploy**.
2. When it says Ready, open **https://aura-leads.vercel.app** and sign in with your password.
3. On your phone: open the link, sign in, then **Share → Add to Home Screen**.

Test it: on the AURA website, fill in the consultation form and press **Call me back**.
Within 30 seconds the lead appears in AURA Leads with a chime.

## Good to know
- Change the password: edit `DASHBOARD_PASSWORD`, then Redeploy. That also signs out every device.
- Lost a phone? In the dashboard footer, tap **Sign out on all devices**.
- After 8 wrong passwords, sign-in pauses for 15 minutes.
- Want the "Assigned to" list to show your team? Add `TEAM` with names separated by commas (for example `Aravind, Ravi`), then Redeploy.
- Download every lead as a spreadsheet file any time with **Download CSV** at the bottom of the list.
- Add `?demo` to the link to see made-up sample leads.
