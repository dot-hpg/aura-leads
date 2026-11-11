# AURA Leads dashboard: switch it on (about 10 minutes, once)

The dashboard is a private web page that shows every "Call me back" and WhatsApp
enquiry from the website, live, with charts and a list you can update.
Your Google Sheet stays the place where the leads are stored. The page only reads
and updates it after you sign in with your owner password.

Do everything below signed in **only** as `contact.smarthomesaura@gmail.com`
(an incognito window is easiest).

## Part 1: Update the sheet's script (3 minutes)
1. Open the AURA Enquiries sheet, then **Extensions → Apps Script**.
2. Delete everything in the editor, paste **all** of `sheet-script/Code.gs` from this repo, press **Save**.
3. Click **Deploy → Manage deployments**, click the ✏️ pencil, set **Version: New version**, press **Deploy**.
   (This keeps the same link, so the website form keeps working.)
4. Go back to the sheet tab and reload the page.

## Part 2: Set your dashboard password (1 minute)
1. In the sheet's top menu: **🏠 AURA → 🔑 Set dashboard password**.
   The first time, Google asks for permission again: **Allow**.
2. Type a password of at least 8 characters and press OK. Only you should know it.
- Forgot it? Set a new one the same way. That also signs out every phone and laptop.
- Lost your phone? **🏠 AURA → 🚪 Sign out all dashboard devices**.
- After 8 wrong tries, sign-in is blocked for 15 minutes.

## Part 3: Give the dashboard its own website (3 minutes)
1. Open **vercel.com**, sign in, and click **Add New… → Project**.
2. Next to your **aura-leads** GitHub repository, click **Import**.
3. Press **Deploy** (no settings to change). When it finishes, your link is
   **https://aura-leads.vercel.app** (Vercel shows the exact link on the success screen).
4. On your phone, open the link, sign in, then **Share → Add to Home Screen**.
   It then opens like an app.

From then on, every change Claude makes to the dashboard goes live by itself.

## Try it without signing in
Open the link with `?demo` at the end (for example `https://aura-leads.vercel.app/?demo`)
to see the dashboard with made-up sample leads. Nothing is saved.
