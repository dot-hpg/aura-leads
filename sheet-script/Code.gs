/**
 * AURA Smart Homes · Enquiries sheet  (version 3, November 2026: adds the private leads dashboard)
 * ---------------------------------------------------------------
 * Paste this whole file into a NEW, EMPTY Google Sheet:
 *   Extensions > Apps Script > delete what is there > paste > Save.
 * Then pick "setup" in the function box at the top and press Run.
 * The script builds every tab, colour, dropdown and chart by itself.
 *
 * Tabs it makes:
 *   🏠 Dashboard  live numbers, bars and charts
 *   🔔 Today      who to call now, follow-ups due, visits coming up
 *   📋 Enquiries  one row per website enquiry, with Status / Priority / Follow-up
 *   ⚙️ Settings   alert email, morning summary, WhatsApp greeting, team names
 *   📖 Guide      how to use the sheet every day
 *
 * Running "setup" again is safe: it repairs the design and never deletes enquiries.
 */

// ===== Settings you may change =====================================================
const DEFAULT_ALERT_EMAIL = 'contact.smarthomesaura@gmail.com';
const TIME_ZONE = 'Asia/Kolkata';
const SUMMARY_HOUR = 9;          // morning summary email, 24-hour clock
const START_ROWS = 2000;         // empty rows prepared in the Enquiries tab

// ===== Names (tabs can be renamed later; the script finds them by their ID) =========
const TAB = {
  dash: '🏠 Dashboard', today: '🔔 Today', enq: '📋 Enquiries',
  settings: '⚙️ Settings', guide: '📖 Guide', data: '_data', log: '_log'
};

const ST = {
  NEW: '🆕 New', CALLED: '📞 Called', VISIT: '📅 Visit fixed', VISITED: '🏠 Visited',
  QUOTE: '📝 Quote sent', NEGO: '🤝 Negotiating', WON: '✅ Won', LOST: '❌ Lost', NORESP: '💤 No response'
};
const STATUS_STYLE = [ // [status, background, text colour]
  [ST.NEW, '#E0F2FE', '#075985'], [ST.CALLED, '#EDE9FE', '#5B21B6'], [ST.VISIT, '#FEF3C7', '#92400E'],
  [ST.VISITED, '#FFEDD5', '#9A3412'], [ST.QUOTE, '#E0E7FF', '#3730A3'], [ST.NEGO, '#FCE7F3', '#9D174D'],
  [ST.WON, '#DCFCE7', '#166534'], [ST.LOST, '#F3F4F6', '#6B7280'], [ST.NORESP, '#F1F5F9', '#475569']
];
const PR = { HOT: '🔥 Hot', WARM: '🌤 Warm', COLD: '❄️ Cold' };
const PRIORITY_STYLE = [[PR.HOT, '#FEE2E2', '#B91C1C'], [PR.WARM, '#FEF9C3', '#854D0E'], [PR.COLD, '#E0F2FE', '#0369A1']];

// Days until the next follow-up, suggested when Status changes.
const NEXT_FOLLOW_UP_DAYS = {};
NEXT_FOLLOW_UP_DAYS[ST.CALLED] = 2; NEXT_FOLLOW_UP_DAYS[ST.VISIT] = 1; NEXT_FOLLOW_UP_DAYS[ST.VISITED] = 1;
NEXT_FOLLOW_UP_DAYS[ST.QUOTE] = 3; NEXT_FOLLOW_UP_DAYS[ST.NEGO] = 2; NEXT_FOLLOW_UP_DAYS[ST.NORESP] = 3;

// What the website form sends (index.html, buildLead).
const PRODUCTS = [
  ['🎛️ Smart switches', 'Smart switch boards'], ['🔐 Door lock', 'Smart door lock'],
  ['🔔 Video door bell', 'Video door bell'], ['📹 Cameras', 'CCTV cameras'],
  ['💡 Lighting', 'Smart lighting'], ['🪟 Curtains', 'Motorised curtains'],
  ['🗄️ Cabinet locks', 'Smart cabinet locks'], ['🎬 Voice & theatre', 'Voice control / home theatre'],
  ['🏡 Full home', 'Full home automation']
];
const PROPERTIES = [
  ['2 BHK apartment', '2 BHK apartment'], ['3 BHK apartment', '3 BHK apartment'], ['4 BHK+ apartment', '4 BHK+ apartment'],
  ['Villa / independent house', 'Villa / independent house'], ['Office / hotel', 'Office / hotel'], ['Other', 'Other']
];
const STAGES = [['🏗️ Under construction', 'Under construction'], ['🎨 Interiors in progress', 'Interiors in progress'], ['🛋️ Ready / living in', 'Ready / living in']];

// Enquiries columns, in order: [key, header, width, note]
const COLS = [
  ['received', '🕒 Received', 140, 'When the enquiry arrived from the website.'],
  ['name', '👤 Name', 170, ''],
  ['mobile', '📱 Mobile', 115, '10-digit mobile number (India).'],
  ['whatsapp', '💬 WhatsApp', 115, 'Tap to open WhatsApp with a ready greeting (edit it in ⚙️ Settings).'],
  ['status', '🚦 Status', 150, 'Change this after every call. The sheet stamps the time and suggests the next follow-up date.'],
  ['priority', '🔥 Priority', 105, 'Set automatically (Hot: visit within a week, villa or office, full home, or 3+ products). Change it any time.'],
  ['followup', '📅 Next follow-up', 135, 'Red = overdue, amber = today. Filled in for you when Status changes; type any date to change it.'],
  ['notes', '📝 Team notes', 260, 'What the customer said, budget, next step.'],
  ['assigned', '🙋 Assigned to', 130, 'Names come from ⚙️ Settings.'],
  ['wants', '☎️ Wants', 120, 'Call back, WhatsApp, or both.'],
  ['interests', '✨ Interested in', 260, ''],
  ['property', '🏢 Property', 160, ''],
  ['stage', '🧱 Home stage', 150, ''],
  ['area', '📍 Area', 120, ''],
  ['visitType', '🚗 Visit type', 170, ''],
  ['visitDate', '🗓️ Preferred date', 125, ''],
  ['visitTime', '⏰ Preferred time', 150, ''],
  ['custNote', '💭 Customer note', 220, 'What the customer typed in the form.'],
  ['quote', '₹ Quote', 105, 'Quote amount in rupees. Feeds the Dashboard totals.'],
  ['age', '⏱ Age', 75, 'How long since the enquiry came in.'],
  ['repeat', '🔁 Repeat', 120, 'Shows when this mobile number has enquired before.'],
  ['ref', '🔖 Reference', 135, 'Reference number shown to the customer on the website.'],
  ['updated', '✏️ Last update', 140, 'Stamped when Status, Priority, Follow-up, Notes, Assigned or Quote is changed.'],
  ['device', '📲 Device', 85, ''],
  ['page', '🌐 Page', 180, ''],
  ['referrer', '↪️ Came from', 180, 'The site the visitor came from, if any.']
];
const C = {}; COLS.forEach((c, i) => { C[c[0]] = i + 1; });
const NAMED = ['received', 'name', 'mobile', 'status', 'priority', 'followup', 'notes', 'assigned', 'wants',
  'interests', 'property', 'stage', 'area', 'visitType', 'visitDate', 'visitTime', 'quote', 'ref'];

const BRAND = { navy: '#0D1A2B', navy2: '#13263D', cyan: '#2BC6EA', cyanSoft: '#4FDCF5', page: '#F3F6FA', line: '#E3E9F0', ink: '#0D1A2B', muted: '#64748B' };
const FONT = 'Roboto', TITLE_FONT = 'Montserrat';

// =================================================================================
// 1) WEBSITE  ->  SHEET
// =================================================================================

function doPost(e) {
  let raw = '';
  try {
    raw = (e && e.postData && e.postData.contents) || '';
    let d = {};
    try { d = raw ? JSON.parse(raw) : {}; } catch (_) { d = {}; }
    if (!d.name && e && e.parameter) d = Object.assign({}, e.parameter, d);
    if (d.action) return json_(dashboardApi_(d)); // private owner dashboard
    const res = saveEnquiry_(d);
    if (!res.ok) log_('Rejected', res.error, raw);
    return json_(res);
  } catch (err) {
    log_('Error', String(err && err.stack || err), raw);
    return json_({ ok: false, error: String(err) });
  }
}

// Open the web-app link in a browser to check it works.
// Add ?test=1 to the end of the link to add a test enquiry.
function doGet(e) {
  const p = (e && e.parameter) || {};
  let msg = '✅ Your AURA enquiries link is working.', sub = 'Website enquiries will appear in the 📋 Enquiries tab.';
  if (p.test === '1') {
    const res = saveEnquiry_(testLead_('Browser test'));
    msg = res.ok ? '🎉 Test enquiry added (row ' + res.row + ').' : '⚠️ ' + res.error;
    sub = 'Open the sheet to see it. Remove it with 🏠 AURA > 🧹 Remove test enquiries.';
  }
  const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:32px;border-radius:18px;' +
    'background:#0D1A2B;color:#fff;text-align:center"><div style="font-size:13px;letter-spacing:2px;color:#4FDCF5">AURA SMART HOMES</div>' +
    '<h2 style="margin:14px 0 8px">' + esc_(msg) + '</h2><p style="color:#B8C7D9;margin:0">' + esc_(sub) + '</p></div>';
  return HtmlService.createHtmlOutput(html).setTitle('AURA enquiries');
}

function saveEnquiry_(d) {
  const name = clean_(d.name, 80);
  const phone = String(d.phone || d.mobile || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '').slice(-10);
  if (!name) return { ok: false, error: 'Name is missing' };
  if (!/^[6-9]\d{9}$/.test(phone)) return { ok: false, error: 'Mobile must be 10 digits' };

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = book_(), sh = enqSheet_(ss);
    const ref = clean_(d.id || d.ref, 40) || ('AURA-' + Utilities.formatDate(new Date(), TIME_ZONE, 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());
    const wants = /whatsapp/i.test(d.prefer || '') ? 'WhatsApp' : 'Call back';
    const last = sh.getLastRow();
    const n = Math.max(0, last - 1);

    // Same reference sent twice (customer pressed both buttons): update the row, don't duplicate.
    if (n) {
      const refs = sh.getRange(2, C.ref, n, 1).getDisplayValues();
      for (let i = 0; i < n; i++) {
        if (refs[i][0] === ref) {
          const r = i + 2, cell = sh.getRange(r, C.wants), was = String(cell.getValue());
          if (was && was.indexOf(wants) < 0) cell.setValue('Call back + WhatsApp');
          return { ok: true, row: r, duplicate: true };
        }
      }
    }

    // Has this number enquired before?
    let earlier = 0;
    if (n) sh.getRange(2, C.mobile, n, 1).getDisplayValues().forEach(v => { if (String(v[0]).replace(/\D/g, '').slice(-10) === phone) earlier++; });

    const visitDate = /^\d{4}-\d{2}-\d{2}$/.test(d.visitDate || '') ? new Date(d.visitDate + 'T00:00:00+05:30') : '';
    const interests = clean_(d.interests, 400);
    const lead = {
      name: name, phone: phone, ref: ref, wants: wants, interests: interests,
      area: clean_(d.area, 80), property: clean_(d.property, 60), stage: clean_(d.stage, 60),
      visitType: clean_(d.visitType, 60), visitDate: visitDate, visitTime: clean_(d.visitTime, 60), note: clean_(d.note, 1000)
    };
    lead.priority = autoPriority_(lead);

    let r = last + 1;
    if (r > sh.getMaxRows() - 5) { sh.insertRowsBefore(sh.getMaxRows(), 500); }
    const row = new Array(COLS.length).fill('');
    const L = k => colLetter_(C[k]);
    row[C.received - 1] = new Date();
    row[C.name - 1] = name;
    row[C.mobile - 1] = phone;
    row[C.whatsapp - 1] = '=HYPERLINK("' + waLink_(lead) + '","💬 Chat")';
    row[C.status - 1] = ST.NEW;
    row[C.priority - 1] = lead.priority;
    row[C.wants - 1] = wants;
    row[C.interests - 1] = interests;
    row[C.property - 1] = lead.property;
    row[C.stage - 1] = lead.stage;
    row[C.area - 1] = lead.area;
    row[C.visitType - 1] = lead.visitType;
    row[C.visitDate - 1] = visitDate;
    row[C.visitTime - 1] = lead.visitTime;
    row[C.custNote - 1] = lead.note;
    row[C.age - 1] = '=IF($' + L('received') + r + '="","",IF(OR($' + L('status') + r + '="' + ST.WON + '",$' + L('status') + r + '="' + ST.LOST + '"),"✔",' +
      'IF(NOW()-$' + L('received') + r + '<1/24,"just now",IF(NOW()-$' + L('received') + r + '<1,ROUNDDOWN((NOW()-$' + L('received') + r + ')*24)&" h",ROUNDDOWN(NOW()-$' + L('received') + r + ')&" d"))))';
    row[C.repeat - 1] = earlier ? '🔁 ' + ordinal_(earlier + 1) + ' enquiry' : '';
    row[C.ref - 1] = ref;
    row[C.device - 1] = clean_(d.device, 30);
    row[C.page - 1] = clean_(d.page, 300);
    row[C.referrer - 1] = clean_(d.referrer || d.source, 300);
    sh.getRange(r, C.mobile).setNumberFormat('@');
    sh.getRange(r, 1, 1, COLS.length).setValues([row]);
    SpreadsheetApp.flush();

    lead.row = r; lead.earlier = earlier;
    try { alertEmail_(ss, sh, lead); } catch (err) { log_('Email', String(err), ref); }
    return { ok: true, row: r };
  } finally {
    lock.releaseLock();
  }
}

function autoPriority_(l) {
  const count = l.interests ? l.interests.split(',').filter(s => s.trim()).length : 0;
  const soon = l.visitDate && (l.visitDate - new Date()) < 8 * 864e5;
  if (soon || count >= 3 || /full home/i.test(l.interests) || /villa|office|hotel/i.test(l.property)) return PR.HOT;
  return PR.WARM;
}

function waLink_(l) {
  let t = String(cfg_('greeting') || 'Hi {first}, this is AURA Smart Homes. Thanks for your enquiry! When is a good time for a quick call?');
  t = t.replace(/\{first\}/g, l.name.split(' ')[0]).replace(/\{name\}/g, l.name)
    .replace(/\{interests\}/g, l.interests ? l.interests.toLowerCase() : 'smart home automation').replace(/\{ref\}/g, l.ref);
  return 'https://wa.me/91' + l.phone + '?text=' + encodeURIComponent(t);
}

// =================================================================================
// 2) EMAILS
// =================================================================================

function alertEmail_(ss, sh, l) {
  if (cfg_('alerts') === false) return;
  const to = String(cfg_('email') || DEFAULT_ALERT_EMAIL || Session.getEffectiveUser().getEmail()).trim();
  if (!to) return;
  const first = l.name.split(' ')[0];
  const rowUrl = ss.getUrl() + '#gid=' + sh.getSheetId() + '&range=A' + l.row;
  const visit = [l.visitType, l.visitDate ? Utilities.formatDate(l.visitDate, TIME_ZONE, 'EEE d MMM') : '', l.visitTime].filter(String).join(' · ');
  const subject = (l.priority === PR.HOT ? '🔥 ' : '🔔 ') + (l.wants === 'WhatsApp' ? 'WhatsApp' : 'Call back') + ': ' + l.name +
    (l.area ? ', ' + l.area : '') + (l.property ? ' (' + l.property + ')' : '');
  const rows = [['Mobile', '+91 ' + l.phone.slice(0, 5) + ' ' + l.phone.slice(5)], ['Wants', l.wants], ['Interested in', l.interests],
    ['Property', [l.property, l.stage].filter(String).join(' · ')], ['Area', l.area], ['Visit', visit], ['Note', l.note],
    ['Priority', l.priority], ['Reference', l.ref]].filter(x => x[1]);
  if (l.earlier) rows.unshift(['Repeat', '🔁 This number has enquired ' + l.earlier + ' time' + (l.earlier > 1 ? 's' : '') + ' before']);
  const btn = (href, label, bg, fg) => '<a href="' + href + '" style="display:inline-block;margin:4px 6px 4px 0;padding:12px 18px;border-radius:999px;background:' + bg +
    ';color:' + fg + ';font-weight:bold;text-decoration:none;font-size:14px">' + label + '</a>';
  const html = '<div style="background:#F3F6FA;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E3E9F0">' +
    '<div style="background:#0D1A2B;padding:22px 24px"><div style="color:#4FDCF5;font-size:12px;letter-spacing:2px">AURA SMART HOMES · NEW ENQUIRY</div>' +
    '<div style="color:#fff;font-size:24px;font-weight:bold;margin-top:6px">' + esc_(l.name) + '</div>' +
    '<div style="color:#B8C7D9;font-size:14px;margin-top:4px">' + esc_(l.wants === 'WhatsApp' ? 'Started a WhatsApp chat' : 'Asked for a call back') +
    ' · ' + esc_(Utilities.formatDate(new Date(), TIME_ZONE, 'EEE d MMM, h:mm a')) + '</div></div>' +
    '<div style="padding:20px 24px 6px">' + btn('tel:+91' + l.phone, '📞 Call ' + esc_(first), '#2BC6EA', '#0D1A2B') +
    btn(waLink_(l), '💬 WhatsApp', '#25D366', '#fff') + btn(rowUrl, 'Open in sheet', '#EEF2F7', '#0D1A2B') + '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin:8px 0 18px">' + rows.map(x =>
      '<tr><td style="padding:9px 24px;color:#64748B;font-size:13px;width:120px;vertical-align:top;border-top:1px solid #EEF2F7">' + esc_(x[0]) +
      '</td><td style="padding:9px 24px 9px 0;color:#0D1A2B;font-size:14px;border-top:1px solid #EEF2F7">' + esc_(x[1]) + '</td></tr>').join('') + '</table>' +
    '<div style="background:#F8FAFC;padding:14px 24px;color:#64748B;font-size:12px">Tip: call within the hour. Fast replies win most smart home jobs. Change 🚦 Status in the sheet after the call.</div>' +
    '</div></div>';
  const text = subject + '\n\n' + rows.map(x => x[0] + ': ' + x[1]).join('\n') + '\n\nWhatsApp: ' + waLink_(l) + '\nSheet: ' + rowUrl;
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, body: text, name: 'AURA Enquiries' });
}

// Runs every morning (set up by "setup"). Emails who to call and what is due.
function dailySummary() { sendSummary_(false); }
function sendSummaryNow() { sendSummary_(true); toast_('Summary email sent to ' + (cfg_('email') || DEFAULT_ALERT_EMAIL), '📧 Done'); }

function sendSummary_(force) {
  if (!force && cfg_('daily') === false) return;
  const ss = book_(), sh = enqSheet_(ss), n = sh.getLastRow() - 1;
  const today = startOfDay_(new Date()), yest = new Date(today.getTime() - 864e5);
  const rows = n > 0 ? sh.getRange(2, 1, n, COLS.length).getValues() : [];
  const g = (r, k) => r[C[k] - 1];
  const open = r => g(r, 'status') !== ST.WON && g(r, 'status') !== ST.LOST;
  const waiting = rows.filter(r => g(r, 'name') && g(r, 'status') === ST.NEW);
  const due = rows.filter(r => g(r, 'name') && open(r) && g(r, 'followup') instanceof Date && g(r, 'followup') < new Date(today.getTime() + 864e5) && g(r, 'status') !== ST.NEW);
  const visits = rows.filter(r => g(r, 'name') && open(r) && g(r, 'visitDate') instanceof Date && startOfDay_(g(r, 'visitDate')).getTime() === today.getTime());
  const newYest = rows.filter(r => g(r, 'received') instanceof Date && g(r, 'received') >= yest && g(r, 'received') < today).length;
  if (!force && !waiting.length && !due.length && !visits.length && !newYest) return;

  const list = (title, items, line) => !items.length ? '' : '<h3 style="margin:22px 0 8px;font-size:15px;color:#0D1A2B">' + title + ' (' + items.length + ')</h3>' +
    items.slice(0, 25).map(r => '<div style="padding:10px 14px;margin:6px 0;border-radius:12px;background:#F6F9FC;font-size:14px;color:#0D1A2B">' + line(r) + '</div>').join('');
  const who = r => '<b>' + esc_(g(r, 'name')) + '</b> · <a href="tel:+91' + g(r, 'mobile') + '" style="color:#0E7490">+91 ' + esc_(g(r, 'mobile')) + '</a>';
  const html = '<div style="background:#F3F6FA;padding:24px 12px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:24px;border:1px solid #E3E9F0">' +
    '<div style="color:#0E7490;font-size:12px;letter-spacing:2px">AURA SMART HOMES · ' + esc_(Utilities.formatDate(new Date(), TIME_ZONE, 'EEEE d MMMM').toUpperCase()) + '</div>' +
    '<h2 style="margin:8px 0 4px;color:#0D1A2B">Good morning ☀️</h2><div style="color:#64748B;font-size:14px">' +
    newYest + ' new enquir' + (newYest === 1 ? 'y' : 'ies') + ' yesterday · ' + waiting.length + ' waiting for a call · ' + due.length + ' follow-up' + (due.length === 1 ? '' : 's') + ' due</div>' +
    list('📞 Call these first', waiting, r => who(r) + '<br><span style="color:#64748B">' + esc_([g(r, 'interests'), g(r, 'area')].filter(String).join(' · ')) + '</span>') +
    list('🏠 Visits today', visits, r => who(r) + '<br><span style="color:#64748B">' + esc_([g(r, 'visitTime'), g(r, 'area')].filter(String).join(' · ')) + '</span>') +
    list('⏰ Follow-ups due', due, r => who(r) + ' · ' + esc_(g(r, 'status')) + (g(r, 'notes') ? '<br><span style="color:#64748B">' + esc_(String(g(r, 'notes')).slice(0, 140)) + '</span>' : '')) +
    (!waiting.length && !due.length && !visits.length ? '<p style="font-size:15px">🎉 All caught up. Nothing is waiting today.</p>' : '') +
    '<p style="margin-top:22px"><a href="' + ss.getUrl() + '" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#2BC6EA;color:#0D1A2B;font-weight:bold;text-decoration:none">Open the enquiries sheet</a></p></div></div>';
  const to = String(cfg_('email') || DEFAULT_ALERT_EMAIL).trim();
  MailApp.sendEmail({ to: to, subject: '☀️ AURA today: ' + waiting.length + ' to call, ' + due.length + ' follow-ups', htmlBody: html, body: 'Open the sheet: ' + ss.getUrl(), name: 'AURA Enquiries' });
}

// =================================================================================
// 3) WHILE YOU WORK IN THE SHEET
// =================================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏠 AURA')
    .addItem('🔔 Go to Today\'s to-do', 'goToday')
    .addItem('➕ Add a test enquiry', 'addTestEnquiry')
    .addItem('🧹 Remove test enquiries', 'removeTestEnquiries')
    .addSeparator()
    .addItem('📧 Email me today\'s summary now', 'sendSummaryNow')
    .addItem('🔗 Show my website link', 'showWebsiteLink')
    .addItem('🛠 Repair sheet design', 'setup')
    .addSeparator()
    .addItem('🔑 Set dashboard password', 'setDashboardPassword')
    .addItem('🚪 Sign out all dashboard devices', 'signOutDashboardEverywhere')
    .addToUi();
}

function onEdit(e) {
  try {
    const rg = e && e.range;
    if (!rg) return;
    const sh = rg.getSheet();
    if (String(sh.getSheetId()) !== prop_('ENQ_ID') && sh.getName() !== TAB.enq) return;
    if (rg.getRow() < 2 || rg.getNumColumns() > 1 || rg.getNumRows() > 50) return;
    const col = rg.getColumn();
    const watched = [C.status, C.priority, C.followup, C.notes, C.assigned, C.quote];
    if (watched.indexOf(col) < 0) return;
    const now = new Date(), today = startOfDay_(now);
    for (let i = 0; i < rg.getNumRows(); i++) {
      const r = rg.getRow() + i;
      if (!sh.getRange(r, C.name).getValue()) continue;
      sh.getRange(r, C.updated).setValue(now);
      if (col !== C.status) continue;
      const status = String(sh.getRange(r, C.status).getValue());
      const fu = sh.getRange(r, C.followup), old = fu.getValue();
      if (status === ST.WON || status === ST.LOST) {
        fu.clearContent();
        if (status === ST.WON) e.source.toast('Deal won with ' + sh.getRange(r, C.name).getValue() + '. Brilliant work, team! 🏆', '🎉 WON', 6);
      } else if (NEXT_FOLLOW_UP_DAYS[status] && (!(old instanceof Date) || old <= today)) {
        let next = new Date(today.getTime() + NEXT_FOLLOW_UP_DAYS[status] * 864e5);
        const pref = sh.getRange(r, C.visitDate).getValue();
        if (status === ST.VISIT && pref instanceof Date && pref >= today) next = startOfDay_(pref);
        fu.setValue(next);
        e.source.toast('Next follow-up set to ' + Utilities.formatDate(next, TIME_ZONE, 'EEE d MMM') + '. Change the date if you like.', '📅 ' + status, 4);
      }
    }
  } catch (err) { console.error(err); }
}

function goToday() { const s = tab_(book_(), 'TODAY_ID', TAB.today); if (s) s.activate(); }

function addTestEnquiry() {
  const res = saveEnquiry_(testLead_('Menu test'));
  toast_(res.ok ? 'Test enquiry added in row ' + res.row + '. Check your email too.' : res.error, res.ok ? '✅ Test added' : '⚠️ Not added');
}

function removeTestEnquiries() {
  const sh = enqSheet_(book_()), n = sh.getLastRow() - 1;
  if (n < 1) return;
  const refs = sh.getRange(2, C.ref, n, 1).getDisplayValues();
  let removed = 0;
  for (let i = n - 1; i >= 0; i--) if (/^TEST-/.test(refs[i][0])) { sh.deleteRow(i + 2); removed++; }
  toast_(removed + ' test enquir' + (removed === 1 ? 'y' : 'ies') + ' removed.', '🧹 Clean');
}

function showWebsiteLink() {
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (_) {}
  const html = url ? '<p style="font-family:Arial">This is the link the website sends enquiries to:</p>' +
    '<textarea style="width:100%;height:80px;font-size:13px" onclick="this.select()">' + esc_(url) + '</textarea>' +
    '<p style="font-family:Arial;font-size:13px;color:#555">Test it: <a target="_blank" href="' + esc_(url) + '?test=1">open with ?test=1</a> adds a test row.</p>'
    : '<p style="font-family:Arial">Not deployed yet. In Apps Script click <b>Deploy &gt; New deployment</b>, type <b>Web app</b>, Execute as <b>Me</b>, Who has access <b>Anyone</b>.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(460).setHeight(220), '🔗 Website link');
}

function testLead_(where) {
  return {
    id: 'TEST-' + Math.random().toString(36).slice(2, 7).toUpperCase(), prefer: 'Call back', name: 'Test Customer',
    phone: '9876543210', area: 'Kondapur', property: '3 BHK apartment', stage: 'Interiors in progress',
    interests: 'Smart switch boards, Smart door lock, Video door bell', visitType: 'Site visit at my home',
    visitDate: Utilities.formatDate(new Date(Date.now() + 2 * 864e5), TIME_ZONE, 'yyyy-MM-dd'), visitTime: 'Evening (4 pm to 7 pm)',
    note: 'This is a test. Safe to delete.', device: where, page: 'Apps Script test'
  };
}

// Run from the editor to test without the website: pick "testEnquiry", press Run, read the log.
function testEnquiry() { console.log(JSON.stringify(saveEnquiry_(testLead_('Editor test')))); }

// =================================================================================
// 5) OWNER DASHBOARD  (the private web page that shows every lead)
// =================================================================================
// The dashboard page sends POST requests here. Nothing is returned without the
// owner's password: the page swaps the password for a signed pass that lasts
// 30 days (or 12 hours when "Remember this device" is off).
// Set or change the password with 🏠 AURA > 🔑 Set dashboard password.

const DASH_DAYS_REMEMBER = 30;
const DASH_HOURS_SESSION = 12;
const DASH_MAX_FAILS = 8;            // wrong passwords allowed per 15 minutes
const DASH_EDITABLE = ['status', 'priority', 'followup', 'notes', 'assigned', 'quote'];

function dashboardApi_(d) {
  const action = String(d.action || '');
  if (action === 'login') return dashLogin_(d);
  if (!dashTokenOk_(d.token)) return { ok: false, auth: false, error: 'Please sign in again.' };
  if (action === 'leads') return dashLeads_();
  if (action === 'update') return dashUpdate_(d);
  if (action === 'ping') return { ok: true };
  return { ok: false, error: 'Unknown action' };
}

function dashLogin_(d) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('dash_fails') || 0);
  if (fails >= DASH_MAX_FAILS) return { ok: false, locked: true, error: 'Too many wrong tries. Wait 15 minutes and try again.' };
  const salt = prop_('DASH_SALT'), hash = prop_('DASH_HASH');
  if (!salt || !hash) return { ok: false, error: 'No dashboard password yet. In the sheet, use 🏠 AURA > 🔑 Set dashboard password.' };
  Utilities.sleep(400); // slows down guessing
  if (dashHash_(String(d.password || ''), salt) !== hash) {
    cache.put('dash_fails', String(fails + 1), 900);
    log_('Dashboard', 'Wrong password', '');
    return { ok: false, error: 'That password is not right.' };
  }
  cache.remove('dash_fails');
  const ms = d.remember ? DASH_DAYS_REMEMBER * 864e5 : DASH_HOURS_SESSION * 36e5;
  const exp = String(Date.now() + ms);
  return { ok: true, token: exp + '.' + dashSign_(exp), expires: Number(exp) };
}

function dashTokenOk_(t) {
  const parts = String(t || '').split('.');
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  if (Number(parts[0]) < Date.now()) return false;
  return dashSign_(parts[0]) === parts[1];
}

function dashSign_(s) {
  let key = prop_('DASH_KEY');
  if (!key) { key = Utilities.getUuid() + Utilities.getUuid(); setProp_('DASH_KEY', key); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, key)).replace(/=+$/, '');
}

function dashHash_(pw, salt) {
  let h = pw;
  for (let i = 0; i < 500; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + h, Utilities.Charset.UTF_8));
  return h;
}

function dashLeads_() {
  const ss = book_(), sh = enqSheet_(ss), n = sh.getLastRow() - 1;
  const leads = [];
  if (n > 0) {
    const vals = sh.getRange(2, 1, n, COLS.length).getValues();
    const iso = v => v instanceof Date && !isNaN(v) ? v.toISOString() : '';
    vals.forEach((v, i) => {
      if (!v[C.name - 1]) return;
      leads.push({
        row: i + 2, ref: String(v[C.ref - 1]), received: iso(v[C.received - 1]), name: String(v[C.name - 1]),
        mobile: String(v[C.mobile - 1]).replace(/\D/g, '').slice(-10), status: String(v[C.status - 1]), priority: String(v[C.priority - 1]),
        followup: iso(v[C.followup - 1]), notes: String(v[C.notes - 1]), assigned: String(v[C.assigned - 1]), wants: String(v[C.wants - 1]),
        interests: String(v[C.interests - 1]), property: String(v[C.property - 1]), stage: String(v[C.stage - 1]), area: String(v[C.area - 1]),
        visitType: String(v[C.visitType - 1]), visitDate: iso(v[C.visitDate - 1]), visitTime: String(v[C.visitTime - 1]),
        custNote: String(v[C.custNote - 1]), quote: Number(v[C.quote - 1]) || 0, repeat: String(v[C.repeat - 1]),
        updated: iso(v[C.updated - 1]), device: String(v[C.device - 1]), referrer: String(v[C.referrer - 1])
      });
    });
  }
  let team = [];
  try { const r = ss.getRangeByName('cfg_team'); if (r) team = r.getValues().map(x => String(x[0]).trim()).filter(String); } catch (_) {}
  return {
    ok: true, now: new Date().toISOString(), leads: leads, team: team,
    statuses: STATUS_STYLE.map(s => s[0]), priorities: PRIORITY_STYLE.map(s => s[0]),
    greeting: String(cfg_('greeting') || ''), sheetUrl: ss.getUrl()
  };
}

function dashUpdate_(d) {
  const f = d.fields || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = book_(), sh = enqSheet_(ss), n = sh.getLastRow() - 1;
    if (n < 1) return { ok: false, error: 'Lead not found' };
    // Find the row by its reference (rows can move if someone sorts the sheet).
    let r = Number(d.row) || 0;
    if (!(r >= 2 && r <= n + 1 && sh.getRange(r, C.ref).getDisplayValue() === String(d.ref))) {
      r = 0;
      const refs = sh.getRange(2, C.ref, n, 1).getDisplayValues();
      for (let i = 0; i < n; i++) if (refs[i][0] === String(d.ref)) { r = i + 2; break; }
    }
    if (!r) return { ok: false, error: 'Lead not found. It may have been deleted from the sheet.' };

    const now = new Date(), today = startOfDay_(now);
    const oldStatus = String(sh.getRange(r, C.status).getValue());
    let followSet = false;
    DASH_EDITABLE.forEach(k => {
      if (!(k in f)) return;
      let v = f[k];
      if (k === 'status' && STATUS_STYLE.map(s => s[0]).indexOf(v) < 0) return;
      if (k === 'priority' && v && PRIORITY_STYLE.map(s => s[0]).indexOf(v) < 0) return;
      if (k === 'followup') { v = /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(v + 'T00:00:00+05:30') : ''; followSet = true; }
      else if (k === 'quote') v = Math.max(0, Math.round(Number(String(v).replace(/[^\d.]/g, '')) || 0)) || '';
      else v = clean_(v, k === 'notes' ? 2000 : 80);
      sh.getRange(r, C[k]).setValue(v);
    });

    // Same helpers as editing in the sheet: next follow-up date when Status changes.
    const status = String(sh.getRange(r, C.status).getValue());
    if (status !== oldStatus && !followSet) {
      const fu = sh.getRange(r, C.followup), old = fu.getValue();
      if (status === ST.WON || status === ST.LOST) fu.clearContent();
      else if (NEXT_FOLLOW_UP_DAYS[status] && (!(old instanceof Date) || old <= today)) {
        let next = new Date(today.getTime() + NEXT_FOLLOW_UP_DAYS[status] * 864e5);
        const pref = sh.getRange(r, C.visitDate).getValue();
        if (status === ST.VISIT && pref instanceof Date && pref >= today) next = startOfDay_(pref);
        fu.setValue(next);
      }
    }
    sh.getRange(r, C.updated).setValue(now);
    SpreadsheetApp.flush();
    const v = sh.getRange(r, 1, 1, COLS.length).getValues()[0];
    const iso = x => x instanceof Date && !isNaN(x) ? x.toISOString() : '';
    return {
      ok: true, lead: {
        row: r, ref: String(d.ref), status: String(v[C.status - 1]), priority: String(v[C.priority - 1]), followup: iso(v[C.followup - 1]),
        notes: String(v[C.notes - 1]), assigned: String(v[C.assigned - 1]), quote: Number(v[C.quote - 1]) || 0, updated: iso(v[C.updated - 1])
      }
    };
  } finally {
    lock.releaseLock();
  }
}

// 🏠 AURA > 🔑 Set dashboard password
function setDashboardPassword() {
  const ui = SpreadsheetApp.getUi();
  const a = ui.prompt('🔑 Dashboard password', 'Type a new password for your private leads dashboard (at least 8 characters).\nAnyone with this password can see every lead, so keep it to yourself.', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const pw = a.getResponseText().trim();
  if (pw.length < 8) { ui.alert('Please use at least 8 characters. Nothing was changed.'); return; }
  const salt = Utilities.getUuid();
  setProp_('DASH_SALT', salt);
  setProp_('DASH_HASH', dashHash_(pw, salt));
  setProp_('DASH_KEY', Utilities.getUuid() + Utilities.getUuid()); // signs out every old device
  CacheService.getScriptCache().remove('dash_fails');
  ui.alert('✅ Password saved. Every device that was signed in has been signed out. Sign in on the dashboard with the new password.');
}

// 🏠 AURA > 🚪 Sign out all dashboard devices
function signOutDashboardEverywhere() {
  setProp_('DASH_KEY', Utilities.getUuid() + Utilities.getUuid());
  toast_('Every phone and computer is now signed out of the dashboard.', '🚪 Signed out');
}

// =================================================================================
// 4) SETUP: builds every tab. Safe to run again.
// =================================================================================

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from the sheet: Extensions > Apps Script.');
  const firstTime = !prop_('SS_ID');
  setProp_('SS_ID', ss.getId());
  try { ss.setSpreadsheetTimeZone(TIME_ZONE); ss.setSpreadsheetLocale('en_IN'); } catch (_) {}
  if (/^Untitled/i.test(ss.getName())) ss.rename('AURA Enquiries');

  const settings = buildSettings_(ss);
  const enq = buildEnquiries_(ss);
  buildData_(ss);
  buildDashboard_(ss);
  buildToday_(ss);
  buildGuide_(ss);
  logSheet_(ss);

  // Tab order and colours
  [[TAB.dash, 'DASH_ID', BRAND.cyan], [TAB.today, 'TODAY_ID', '#F59E0B'], [TAB.enq, 'ENQ_ID', BRAND.navy],
    [TAB.settings, 'SET_ID', '#94A3B8'], [TAB.guide, 'GUIDE_ID', '#22C55E']].forEach((t, i) => {
    const s = tab_(ss, t[1], t[0]); s.setTabColor(t[2]); ss.setActiveSheet(s); ss.moveActiveSheet(i + 1);
  });
  // Remove the empty starter tab
  ss.getSheets().forEach(s => {
    if (/^(Sheet|Sheet1|शीट1)\s*\d*$/.test(s.getName()) && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  // Morning summary trigger (one only)
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailySummary') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailySummary').timeBased().everyDays(1).atHour(SUMMARY_HOUR).inTimezone(TIME_ZONE).create();

  tab_(ss, 'DASH_ID', TAB.dash).activate();
  SpreadsheetApp.flush();
  if (firstTime) { try { welcomeEmail_(ss); } catch (err) { console.log('Welcome email not sent: ' + err); } }
  console.log('✅ AURA enquiries sheet is ready: ' + ss.getUrl());
  console.log('Next: Deploy > New deployment > Web app, Execute as Me, Who has access Anyone. Then send the /exec link to Claude.');
  toast_('Your sheet is ready. Next step: Deploy > New deployment in Apps Script.', '✅ AURA sheet built', 10);
}

function buildEnquiries_(ss) {
  const sh = tab_(ss, 'ENQ_ID', TAB.enq);
  const W = COLS.length;
  if (sh.getMaxRows() < START_ROWS) sh.insertRowsAfter(sh.getMaxRows(), START_ROWS - sh.getMaxRows());
  if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
  if (sh.getMaxColumns() > W) sh.deleteColumns(W + 1, sh.getMaxColumns() - W);
  const R = sh.getMaxRows(), body = sh.getRange(2, 1, R - 1, W);

  sh.getBandings().forEach(b => b.remove());
  if (sh.getFilter()) sh.getFilter().remove();
  sh.clearConditionalFormatRules();

  const head = sh.getRange(1, 1, 1, W);
  head.setValues([COLS.map(c => c[1])]).setFontFamily(TITLE_FONT).setFontWeight('bold').setFontSize(10)
    .setFontColor('#FFFFFF').setBackground(BRAND.navy).setVerticalAlignment('middle').setWrap(false)
    .setBorder(null, null, true, null, null, null, BRAND.cyan, SpreadsheetApp.BorderStyle.SOLID_THICK);
  COLS.forEach((c, i) => { sh.setColumnWidth(i + 1, c[2]); sh.getRange(1, i + 1).setNote(c[3] || ''); });
  sh.setRowHeight(1, 42);
  sh.setFrozenRows(1); sh.setFrozenColumns(2);

  body.setFontFamily(FONT).setFontSize(10).setFontColor(BRAND.ink).setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sh.setRowHeightsForced(2, R - 1, 30);
  const colR = k => sh.getRange(2, C[k], R - 1, 1);
  colR('received').setNumberFormat('d mmm, h:mm am/pm');
  colR('updated').setNumberFormat('d mmm, h:mm am/pm').setFontColor(BRAND.muted);
  colR('mobile').setNumberFormat('@');
  colR('followup').setNumberFormat('ddd d mmm').setHorizontalAlignment('center').setFontWeight('bold');
  colR('visitDate').setNumberFormat('ddd d mmm');
  colR('quote').setNumberFormat('"₹"#,##0');
  colR('name').setFontWeight('bold');
  ['status', 'priority', 'whatsapp', 'age', 'wants', 'device'].forEach(k => colR(k).setHorizontalAlignment('center'));
  ['age', 'repeat', 'ref', 'device', 'page', 'referrer'].forEach(k => colR(k).setFontColor(BRAND.muted));
  colR('status').setFontWeight('bold');

  // Named columns used by the Dashboard and Today formulas
  ss.getNamedRanges().forEach(n => { if (/^enq_/.test(n.getName())) n.remove(); });
  NAMED.forEach(k => ss.setNamedRange('enq_' + k, colR(k)));

  // Dropdowns
  colR('status').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(ss.getRangeByName('list_status'), true).setAllowInvalid(false).build());
  colR('priority').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(ss.getRangeByName('list_priority'), true).setAllowInvalid(false).build());
  colR('assigned').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(ss.getRangeByName('cfg_team'), true).setAllowInvalid(true).build());
  colR('followup').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Pick a date (double-click for a calendar).').build());
  colR('quote').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).setHelpText('Rupees, numbers only').build());

  // Zebra rows
  const band = sh.getRange(1, 1, R, W).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  band.setHeaderRowColor(BRAND.navy).setFirstRowColor('#FFFFFF').setSecondRowColor('#F7FAFC');

  // Colours that follow the work
  const L = k => colLetter_(C[k]);
  const open = 'AND($' + L('status') + '2<>"' + ST.WON + '",$' + L('status') + '2<>"' + ST.LOST + '")';
  const rules = [];
  const rule = (range, formula, bg, fg, bold, strike) => {
    const b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges([range]);
    if (bg) b.setBackground(bg); if (fg) b.setFontColor(fg); if (bold) b.setBold(true); if (strike) b.setStrikethrough(true);
    rules.push(b.build());
  };
  rule(colR('status'), '=AND($' + L('status') + '2="' + ST.NEW + '",$' + L('received') + '2<>"",NOW()-$' + L('received') + '2>1)', '#FECACA', '#991B1B', true);
  STATUS_STYLE.forEach(s => rule(colR('status'), '=$' + L('status') + '2="' + s[0] + '"', s[1], s[2], true));
  PRIORITY_STYLE.forEach(s => rule(colR('priority'), '=$' + L('priority') + '2="' + s[0] + '"', s[1], s[2], true));
  rule(colR('followup'), '=AND($' + L('followup') + '2<>"",$' + L('followup') + '2<TODAY(),' + open + ')', '#FECACA', '#991B1B', true);
  rule(colR('followup'), '=AND($' + L('followup') + '2<>"",INT($' + L('followup') + '2)=TODAY(),' + open + ')', '#FDE68A', '#92400E', true);
  rule(colR('followup'), '=AND($' + L('followup') + '2<>"",$' + L('followup') + '2>TODAY(),' + open + ')', '#E0F2FE', '#075985');
  rule(colR('received'), '=AND($' + L('received') + '2<>"",$' + L('received') + '2>=TODAY())', '#ECFEFF', '#0E7490', true);
  rule(colR('repeat'), '=$' + L('repeat') + '2<>""', '#FEF3C7', '#92400E', true);
  rule(body, '=$' + L('status') + '2="' + ST.WON + '"', '#ECFDF3', '#14532D');
  rule(body, '=$' + L('status') + '2="' + ST.LOST + '"', '#F8FAFC', '#94A3B8', false, true);
  sh.setConditionalFormatRules(rules);

  sh.getRange(1, 1, R, W).createFilter();
  return sh;
}

function buildSettings_(ss) {
  const sh = tab_(ss, 'SET_ID', TAB.settings);
  const fresh = sh.getLastRow() === 0;
  const keep = {};
  if (!fresh) ['email', 'alerts', 'daily', 'greeting'].forEach(k => { const r = ss.getRangeByName('cfg_' + k); if (r) keep[k] = r.getValue(); });
  const team = !fresh && ss.getRangeByName('cfg_team') ? ss.getRangeByName('cfg_team').getValues() : null;
  ss.getNamedRanges().forEach(n => { if (/^(cfg_|list_)/.test(n.getName())) n.remove(); });
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());
  sh.clear(); sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setDataValidation(null);
  sh.setHiddenGridlines(true);
  [24, 300, 380, 24, 170, 24, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, 60, 8).setFontFamily(FONT).setFontColor(BRAND.ink).setVerticalAlignment('middle');

  banner_(sh, 2, 2, 6, '⚙️ Settings', 'Change the yellow cells. Everything else updates by itself.');

  const rowsSet = [
    ['email', '📧 Alert email (new enquiries + morning summary)', DEFAULT_ALERT_EMAIL],
    ['alerts', '🔔 Email me for every new enquiry', true],
    ['daily', '☀️ Morning summary email at ' + SUMMARY_HOUR + ' am', true],
    ['greeting', '💬 WhatsApp greeting used by the 💬 Chat links\n   {first} = first name, {interests} = products, {ref} = reference',
      'Hi {first}, this is AURA Smart Homes 👋 Thanks for your enquiry about {interests}. When is a good time for a quick call?']
  ];
  rowsSet.forEach((s, i) => {
    const r = 6 + i;
    sh.getRange(r, 2).setValue(s[1]).setFontWeight('bold').setWrap(true);
    const cell = sh.getRange(r, 3);
    if (typeof s[2] === 'boolean') { cell.insertCheckboxes(); cell.setValue(keep[s[0]] !== undefined ? keep[s[0]] === true : s[2]).setHorizontalAlignment('left'); }
    else cell.setValue(keep[s[0]] || s[2]).setWrap(true);
    cell.setBackground('#FFFBEB').setBorder(true, true, true, true, null, null, '#FCD34D', SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(r, s[0] === 'greeting' ? 64 : 36);
    ss.setNamedRange('cfg_' + s[0], cell);
  });

  const lists = [
    [2, '🙋 Team members (for "Assigned to")', team ? team.map(r => r[0]) : ['Aravind', 'Team member 2', 'Team member 3'], 'cfg_team', 12, true],
    [5, '🚦 Statuses', STATUS_STYLE.map(s => s[0]), 'list_status', 9, false],
    [7, '🔥 Priority', PRIORITY_STYLE.map(s => s[0]), 'list_priority', 3, false]
  ];
  lists.forEach(l => {
    sh.getRange(12, l[0]).setValue(l[1]).setFontWeight('bold').setFontColor(BRAND.muted);
    const vals = []; for (let i = 0; i < l[4]; i++) vals.push([l[2][i] || '']);
    const rg = sh.getRange(13, l[0], l[4], 1).setValues(vals).setBorder(true, true, true, true, false, true, BRAND.line, SpreadsheetApp.BorderStyle.SOLID);
    if (l[5]) rg.setBackground('#FFFBEB');
    ss.setNamedRange(l[3], rg);
    if (!l[5]) rg.protect().setDescription('Built-in list used by colours and the dashboard').setWarningOnly(true);
  });
  STATUS_STYLE.forEach((s, i) => sh.getRange(13 + i, 5).setBackground(s[1]).setFontColor(s[2]).setFontWeight('bold'));
  PRIORITY_STYLE.forEach((s, i) => sh.getRange(13 + i, 7).setBackground(s[1]).setFontColor(s[2]).setFontWeight('bold'));
  mv_(sh.getRange(23, 5, 1, 3), 'Please keep these names as they are: the colours and the dashboard use them.').setFontColor(BRAND.muted).setFontSize(9).setWrap(true);
  sh.setRowHeight(23, 34);
  sh.getRange(26, 2).setValue('Tip: the sheet also sends a morning summary at ' + SUMMARY_HOUR + ' am (India time) only on days with something to do.').setFontColor(BRAND.muted).setFontSize(9);
  return sh;
}

function buildData_(ss) {
  const sh = tab_(ss, 'DATA_ID', TAB.data);
  sh.clear();
  sh.getRange('A1:E1').setValues([['Received', 'Name', 'Area', 'Wants', 'Status']]);
  sh.getRange('A2').setFormula('=IFERROR(QUERY({enq_received,enq_name,enq_area,enq_wants,enq_status},"select * where Col1 is not null order by Col1 desc limit 6",0),"")');
  sh.getRange('A2:A7').setNumberFormat('d mmm, h:mm am/pm');
  sh.getRange('H1:I1').setValues([['Day', 'Enquiries']]);
  const days = [];
  for (let i = 0; i < 30; i++) days.push(['=TODAY()-' + (29 - i), '=COUNTIFS(enq_received,">="&H' + (i + 2) + ',enq_received,"<"&H' + (i + 2) + '+1)']);
  sh.getRange(2, 8, 30, 2).setFormulas(days);
  sh.getRange('H2:H31').setNumberFormat('d mmm');
  sh.getRange('K1:L4').setValues([['Contact by', 'Count'], ['Call back', ''], ['WhatsApp', ''], ['Both', '']]);
  sh.getRange('L2:L4').setFormulas([['=COUNTIF(enq_wants,"Call back")'], ['=COUNTIF(enq_wants,"WhatsApp")'], ['=COUNTIF(enq_wants,"Call back + WhatsApp")']]);
  sh.hideSheet();
  return sh;
}

function buildDashboard_(ss) {
  const sh = tab_(ss, 'DASH_ID', TAB.dash);
  sh.getCharts().forEach(c => sh.removeChart(c));
  resetSheet_(sh, 70, 16);
  sh.setHiddenGridlines(true);
  // A gutter | 5 tiles of 2 columns with 14px gaps | P gutter
  const widths = [22, 96, 96, 14, 96, 96, 14, 96, 96, 14, 96, 96, 14, 96, 96, 22];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  const all = sh.getRange(1, 1, 70, 16);
  all.setBackground(BRAND.page).setFontFamily(FONT).setFontColor(BRAND.ink).setVerticalAlignment('middle');
  sh.setRowHeights(1, 70, 22);
  const tileCol = i => 2 + i * 3;
  const D = "'" + TAB.data + "'!";
  const OPEN = 'enq_status,"<>' + ST.WON + '",enq_status,"<>' + ST.LOST + '"';

  // Header band
  sh.setRowHeight(1, 14);
  const hb = sh.getRange(2, 2, 2, 14).setBackground(BRAND.navy);
  hb.setBorder(null, null, true, null, null, null, BRAND.cyan, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.setRowHeight(2, 46); sh.setRowHeight(3, 28);
  mv_(sh.getRange(2, 2, 1, 9), '  AURA Smart Homes · Enquiries').setFontFamily(TITLE_FONT).setFontSize(20).setFontWeight('bold').setFontColor('#FFFFFF');
  mv_(sh.getRange(3, 2, 1, 9), '   Live from your website. Every "Call me back" and "Chat on WhatsApp" lands here.').setFontColor('#9FB3C8').setFontSize(10);
  mf_(sh.getRange(2, 11, 1, 5), '=IF(HOUR(NOW())<12,"Good morning ☀️",IF(HOUR(NOW())<17,"Good afternoon 🌤","Good evening 🌙"))&"  "')
    .setHorizontalAlignment('right').setFontColor(BRAND.cyanSoft).setFontFamily(TITLE_FONT).setFontSize(13).setFontWeight('bold');
  mf_(sh.getRange(3, 11, 1, 5), '=TEXT(NOW(),"dddd, d mmm · h:mm am/pm")&"   "').setHorizontalAlignment('right').setFontColor('#9FB3C8').setFontSize(10);
  sh.setRowHeight(4, 16);

  // KPI tiles
  const tiles = [
    [5, [
      ['TOTAL ENQUIRIES', '=COUNT(enq_received)', '=IF(COUNT(enq_received)=0,"first one coming soon","since "&TEXT(MIN(enq_received),"d mmm yyyy"))', BRAND.cyan, '0'],
      ['TODAY', '=COUNTIF(enq_received,">="&TODAY())', '="yesterday: "&COUNTIFS(enq_received,">="&TODAY()-1,enq_received,"<"&TODAY())', '#0EA5E9', '0'],
      ['WAITING FOR A CALL', '=COUNTIF(enq_status,"' + ST.NEW + '")', '=IF(COUNTIF(enq_status,"' + ST.NEW + '")=0,"all caught up 🎉",COUNTIFS(enq_status,"' + ST.NEW + '",enq_received,"<"&NOW()-1)&" waiting over a day")', '#EF4444', '0'],
      ['FOLLOW-UPS DUE', '=COUNTIFS(enq_followup,"<"&TODAY()+1,' + OPEN + ')', '=COUNTIFS(enq_followup,"<"&TODAY(),' + OPEN + ')&" overdue"', '#F59E0B', '0'],
      ['WON 🏆', '=COUNTIF(enq_status,"' + ST.WON + '")', '=TEXT(IFERROR(COUNTIF(enq_status,"' + ST.WON + '")/COUNT(enq_received),0),"0%")&" of all enquiries"', '#22C55E', '0']
    ]],
    [9, [
      ['LAST 7 DAYS', '=COUNTIF(enq_received,">="&TODAY()-6)', '="week before: "&COUNTIFS(enq_received,">="&TODAY()-13,enq_received,"<"&TODAY()-6)', '#6366F1', '0'],
      ['VISITS', '=COUNTIF(enq_status,"' + ST.VISIT + '")+COUNTIF(enq_status,"' + ST.VISITED + '")', '=COUNTIF(enq_status,"' + ST.VISIT + '")&" booked · "&COUNTIF(enq_status,"' + ST.VISITED + '")&" done"', '#F97316', '0'],
      ['HOT LEADS 🔥', '=COUNTIFS(enq_priority,"' + PR.HOT + '",' + OPEN + ')', '="open and keen to buy"', '#DC2626', '0'],
      ['OPEN QUOTES', '=SUMIFS(enq_quote,' + OPEN + ')', '=COUNTIF(enq_status,"' + ST.QUOTE + '")+COUNTIF(enq_status,"' + ST.NEGO + '")&" quotes in play"', '#8B5CF6', '"₹"#,##0'],
      ['WON VALUE', '=SUMIFS(enq_quote,enq_status,"' + ST.WON + '")', '="from "&COUNTIF(enq_status,"' + ST.WON + '")&" won deals"', '#16A34A', '"₹"#,##0']
    ]]
  ];
  tiles.forEach(block => {
    const r = block[0];
    sh.setRowHeight(r, 26); sh.setRowHeight(r + 1, 46); sh.setRowHeight(r + 2, 24); sh.setRowHeight(r + 3, 14);
    block[1].forEach((t, i) => {
      const c = tileCol(i);
      const box = sh.getRange(r, c, 3, 2).setBackground('#FFFFFF');
      box.setBorder(true, true, true, true, false, false, BRAND.line, SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(r, c, 1, 2).setBorder(true, null, null, null, null, null, t[3], SpreadsheetApp.BorderStyle.SOLID_THICK);
      mv_(sh.getRange(r, c, 1, 2), '  ' + t[0]).setFontSize(8).setFontWeight('bold').setFontColor(BRAND.muted).setVerticalAlignment('bottom');
      mf_(sh.getRange(r + 1, c, 1, 2), t[1]).setNumberFormat(t[4] === '0' ? '"  "0' : '"  ₹"#,##0').setFontFamily(TITLE_FONT)
        .setFontSize(26).setFontWeight('bold').setFontColor(t[3]).setHorizontalAlignment('left').setVerticalAlignment('middle');
      mf_(sh.getRange(r + 2, c, 1, 2), '="   "&' + t[2].slice(1)).setFontSize(9).setFontColor(BRAND.muted).setVerticalAlignment('top');
    });
  });

  // Status pipeline (left) and products (right)
  let r = 14;
  section_(sh, r, 2, 6, '🚦 Where every enquiry stands');
  section_(sh, r, 8, 8, '✨ What customers want');
  const maxS = '$E$' + (r + 1) + ':$E$' + (r + STATUS_STYLE.length);
  STATUS_STYLE.forEach((s, i) => {
    const rr = r + 1 + i;
    mv_(sh.getRange(rr, 2, 1, 3), '  ' + s[0]).setFontWeight('bold').setFontColor(s[2]).setBackground('#FFFFFF');
    sh.getRange(rr, 5).setFormula('=COUNTIF(enq_status,"' + s[0] + '")').setHorizontalAlignment('center').setFontWeight('bold').setBackground('#FFFFFF');
    mf_(sh.getRange(rr, 6, 1, 2), '=SPARKLINE(E' + rr + ',{"charttype","bar";"max",MAX(1,MAX(' + maxS + '));"color1","' + s[2] + '"})').setBackground('#FFFFFF');
  });
  const maxP = '$K$' + (r + 1) + ':$K$' + (r + PRODUCTS.length);
  PRODUCTS.forEach((p, i) => {
    const rr = r + 1 + i;
    mv_(sh.getRange(rr, 8, 1, 3), '  ' + p[0]).setBackground('#FFFFFF');
    sh.getRange(rr, 11).setFormula('=COUNTIF(enq_interests,"*' + p[1] + '*")').setHorizontalAlignment('center').setFontWeight('bold').setBackground('#FFFFFF');
    mf_(sh.getRange(rr, 12, 1, 4), '=SPARKLINE(K' + rr + ',{"charttype","bar";"max",MAX(1,MAX(' + maxP + '));"color1","#2BC6EA"})').setBackground('#FFFFFF');
  });
  sh.setRowHeights(r + 1, 9, 26);
  frame_(sh.getRange(r + 1, 2, 9, 6)); frame_(sh.getRange(r + 1, 8, 9, 8));

  // Property types (left) and home stage (right)
  r = 25;
  sh.setRowHeight(r - 1, 16);
  section_(sh, r, 2, 6, '🏢 Homes we are hearing from');
  section_(sh, r, 8, 8, '🧱 Home stage  ·  ☎️ How they reach out');
  const maxH = '$E$' + (r + 1) + ':$E$' + (r + PROPERTIES.length);
  PROPERTIES.forEach((p, i) => {
    const rr = r + 1 + i;
    mv_(sh.getRange(rr, 2, 1, 3), '  ' + p[0]).setBackground('#FFFFFF');
    sh.getRange(rr, 5).setFormula('=COUNTIF(enq_property,"' + p[1] + '")').setHorizontalAlignment('center').setFontWeight('bold').setBackground('#FFFFFF');
    mf_(sh.getRange(rr, 6, 1, 2), '=SPARKLINE(E' + rr + ',{"charttype","bar";"max",MAX(1,MAX(' + maxH + '));"color1","#6366F1"})').setBackground('#FFFFFF');
  });
  const right = STAGES.map(s => [s[0], '=COUNTIF(enq_stage,"' + s[1] + '")', '#F97316'])
    .concat([['📞 Call back', '=' + D + 'L2+' + D + 'L4', '#0EA5E9'], ['💬 WhatsApp', '=' + D + 'L3+' + D + 'L4', '#22C55E'],
      ['🔁 Repeat enquiries', '=MAX(0,COUNTIF(enq_mobile,"?*")-IFERROR(ROWS(UNIQUE(FILTER(enq_mobile,enq_mobile<>""))),0))', '#F59E0B']]);
  const maxR = '$K$' + (r + 1) + ':$K$' + (r + right.length);
  right.forEach((p, i) => {
    const rr = r + 1 + i;
    mv_(sh.getRange(rr, 8, 1, 3), '  ' + p[0]).setBackground('#FFFFFF');
    sh.getRange(rr, 11).setFormula(p[1]).setHorizontalAlignment('center').setFontWeight('bold').setBackground('#FFFFFF');
    mf_(sh.getRange(rr, 12, 1, 4), '=SPARKLINE(K' + rr + ',{"charttype","bar";"max",MAX(1,MAX(' + maxR + '));"color1","' + p[2] + '"})').setBackground('#FFFFFF');
  });
  sh.setRowHeights(r + 1, 6, 26);
  frame_(sh.getRange(r + 1, 2, 6, 6)); frame_(sh.getRange(r + 1, 8, 6, 8));

  // Charts
  r = 33;
  sh.setRowHeight(r - 1, 16);
  section_(sh, r, 2, 14, '📈 Enquiries in the last 30 days');
  const data = tab_(ss, 'DATA_ID', TAB.data);
  const trend = sh.newChart().setChartType(Charts.ChartType.COLUMN).addRange(data.getRange('H1:I31')).setNumHeaders(1)
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setPosition(r + 1, 2, 0, 6)
    .setOption('width', 610).setOption('height', 270).setOption('legend.position', 'none')
    .setOption('colors', [BRAND.cyan]).setOption('backgroundColor', '#FFFFFF')
    .setOption('vAxis.minValue', 0).setOption('vAxis.format', '0').setOption('vAxis.gridlines.color', '#EEF2F7')
    .setOption('vAxis.textStyle.color', '#64748B').setOption('hAxis.textStyle.color', '#64748B').setOption('hAxis.textStyle.fontSize', 9)
    .setOption('hAxis.slantedText', true).setOption('hAxis.slantedTextAngle', 45).setOption('bar.groupWidth', '70%').build();
  sh.insertChart(trend);
  const pie = sh.newChart().setChartType(Charts.ChartType.PIE).addRange(data.getRange('K1:L4')).setNumHeaders(1)
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setPosition(r + 1, 11, 4, 6)
    .setOption('width', 390).setOption('height', 270).setOption('pieHole', 0.55)
    .setOption('title', 'Call back vs WhatsApp').setOption('titleTextStyle.color', '#0D1A2B').setOption('titleTextStyle.fontSize', 12)
    .setOption('colors', ['#2BC6EA', '#22C55E', '#F59E0B']).setOption('backgroundColor', '#FFFFFF')
    .setOption('legend.position', 'right').setOption('legend.textStyle.color', '#64748B').setOption('pieSliceText', 'value').build();
  sh.insertChart(pie);
  sh.setRowHeights(r + 1, 13, 22);

  // Latest enquiries
  r = 48;
  section_(sh, r, 2, 14, '🆕 Latest enquiries');
  const heads = [['🕒 When', 2], ['👤 Name', 5], ['📍 Area', 8], ['☎️ Wants', 11], ['🚦 Status', 14]];
  heads.forEach(h => mv_(sh.getRange(r + 1, h[1], 1, 2), '  ' + h[0]).setFontSize(9).setFontWeight('bold').setFontColor(BRAND.muted).setBackground('#FFFFFF'));
  for (let i = 0; i < 6; i++) {
    const rr = r + 2 + i, src = i + 2;
    heads.forEach((h, j) => {
      const cell = sh.getRange(rr, h[1], 1, 2);
      const f = (i === 0 && j === 0) ? '=IF(COUNT(enq_received)=0,"  ✨ No enquiries yet. They appear here the moment someone fills the website form.",' + D + 'A2)'
        : '=IF(' + D + colLetter_(j + 1) + src + '="","",' + D + colLetter_(j + 1) + src + ')';
      mf_(cell, f).setBackground('#FFFFFF');
      if (j === 0) cell.setNumberFormat('"  "d mmm, h:mm am/pm');
      if (j === 1) cell.setFontWeight('bold');
      if (j === 4) cell.setFontWeight('bold');
    });
    // spacer columns inside the table stay white
    [4, 7, 10, 13].forEach(c => sh.getRange(rr, c).setBackground('#FFFFFF'));
  }
  [4, 7, 10, 13].forEach(c => sh.getRange(r + 1, c).setBackground('#FFFFFF'));
  sh.setRowHeights(r + 2, 6, 28);
  sh.getRange(r + 2, 2, 6, 14).setBorder(null, null, null, null, null, true, '#EEF2F7', SpreadsheetApp.BorderStyle.SOLID);
  frame_(sh.getRange(r + 1, 2, 7, 14));
  const st = sh.getRange(r + 2, 14, 6, 2), rules = [];
  STATUS_STYLE.forEach(s => rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s[0]).setFontColor(s[2]).setRanges([st]).build()));
  sh.setConditionalFormatRules(rules);

  mv_(sh.getRange(r + 9, 2, 1, 14), 'Numbers update live. Work each enquiry in 📋 Enquiries and your list for the day is in 🔔 Today.')
    .setFontSize(9).setFontColor(BRAND.muted).setHorizontalAlignment('center');
  if (sh.getMaxRows() > 70) sh.deleteRows(71, sh.getMaxRows() - 70);
  if (sh.getMaxColumns() > 16) sh.deleteColumns(17, sh.getMaxColumns() - 16);
  return sh;
}

function buildToday_(ss) {
  const sh = tab_(ss, 'TODAY_ID', TAB.today);
  resetSheet_(sh, 130, 10);
  sh.setHiddenGridlines(true);
  [22, 150, 170, 120, 130, 130, 240, 140, 140, 22].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, 130, 10).setFontFamily(FONT).setFontColor(BRAND.ink).setVerticalAlignment('middle').setBackground('#FFFFFF');
  sh.setRowHeights(1, 130, 26);
  sh.setRowHeight(1, 12);
  const hb = sh.getRange(2, 2, 2, 8).setBackground(BRAND.navy);
  hb.setBorder(null, null, true, null, null, null, '#F59E0B', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.setRowHeight(2, 44); sh.setRowHeight(3, 26);
  mv_(sh.getRange(2, 2, 1, 5), '  🔔 Today\'s to-do').setFontFamily(TITLE_FONT).setFontSize(20).setFontWeight('bold').setFontColor('#FFFFFF');
  mf_(sh.getRange(2, 7, 1, 3), '=TEXT(TODAY(),"dddd, d mmmm")&"  "').setHorizontalAlignment('right').setFontColor('#FCD34D').setFontWeight('bold').setFontFamily(TITLE_FONT);
  mv_(sh.getRange(3, 2, 1, 8), '   Work from top to bottom. Update 🚦 Status in 📋 Enquiries after each call and this list clears itself.').setFontColor('#9FB3C8').setFontSize(10);
  const t = '"&TEXT(TODAY(),"yyyy-mm-dd")&"', t1 = '"&TEXT(TODAY()+1,"yyyy-mm-dd")&"';
  const blocks = [
    [5, '📞 Call these new enquiries first', '#EF4444',
      ['🕒 Received', '👤 Name', '📱 Mobile', '☎️ Wants', '🔥 Priority', '✨ Interested in', '📍 Area', '🗓️ Preferred visit'],
      '=IFERROR(QUERY({enq_received,enq_name,enq_mobile,enq_wants,enq_priority,enq_interests,enq_area,enq_visitDate,enq_status},"select Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8 where Col9 = \'' + ST.NEW + '\' order by Col1 asc limit 30",0),"🎉 Nobody is waiting. Every new enquiry has been called.")',
      ['d mmm, h:mm am/pm', null, '@', null, null, null, null, 'ddd d mmm'], 30],
    [40, '⏰ Follow-ups due today or overdue', '#F59E0B',
      ['📅 Follow-up', '👤 Name', '📱 Mobile', '🚦 Status', '🔥 Priority', '📝 Team notes', '🙋 Assigned to', '✨ Interested in'],
      '=IFERROR(QUERY({enq_followup,enq_name,enq_mobile,enq_status,enq_priority,enq_notes,enq_assigned,enq_interests},"select * where Col1 is not null and Col1 < date \'' + t1 + '\' and Col4 <> \'' + ST.WON + '\' and Col4 <> \'' + ST.LOST + '\' order by Col1 asc limit 40",0),"✅ No follow-ups due. Nice and tidy.")',
      ['ddd d mmm', null, '@', null, null, null, null, null], 40],
    [85, '🏠 Visits in the next 7 days', '#22C55E',
      ['🗓️ Date', '👤 Name', '📱 Mobile', '⏰ Time', '🚗 Visit type', '📍 Area', '🚦 Status', '✨ Interested in'],
      '=IFERROR(QUERY({enq_visitDate,enq_name,enq_mobile,enq_visitTime,enq_visitType,enq_area,enq_status,enq_interests},"select * where Col1 is not null and Col1 >= date \'' + t + '\' and Col1 < date \'"&TEXT(TODAY()+8,"yyyy-mm-dd")&"\' and Col7 <> \'' + ST.WON + '\' and Col7 <> \'' + ST.LOST + '\' order by Col1 asc limit 40",0),"No visits booked for the coming week yet.")',
      ['ddd d mmm', null, '@', null, null, null, null, null], 40]
  ];
  blocks.forEach(b => {
    const r = b[0];
    sh.setRowHeight(r, 34);
    mf_(sh.getRange(r, 2, 1, 8), '="  ' + b[1] + '  ·  "&MAX(0,COUNTA(B' + (r + 2) + ':B' + (r + 1 + b[6]) + ')-IF(ISNUMBER(B' + (r + 2) + '),0,1))')
      .setFontFamily(TITLE_FONT).setFontSize(13).setFontWeight('bold').setFontColor(BRAND.ink)
      .setBorder(null, true, null, null, null, null, b[2], SpreadsheetApp.BorderStyle.SOLID_THICK).setBackground('#F8FAFC');
    sh.getRange(r + 1, 2, 1, 8).setValues([b[3]]).setFontSize(9).setFontWeight('bold').setFontColor(BRAND.muted)
      .setBorder(null, null, true, null, null, null, BRAND.line, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r + 2, 2).setFormula(b[4]);
    b[5].forEach((f, i) => { if (f) sh.getRange(r + 2, 2 + i, b[6], 1).setNumberFormat(f); });
    sh.getRange(r + 2, 3, b[6], 1).setFontWeight('bold');
    sh.getRange(r + 2, 2, b[6], 8).setBorder(null, null, null, null, null, true, '#F1F5F9', SpreadsheetApp.BorderStyle.SOLID)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  });
  const rules = [];
  const all = sh.getRange(5, 2, 125, 8);
  STATUS_STYLE.concat(PRIORITY_STYLE).forEach(s => rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s[0]).setBackground(s[1]).setFontColor(s[2]).setBold(true).setRanges([all]).build()));
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($B42),$B42<TODAY())').setFontColor('#B91C1C').setBold(true).setRanges([sh.getRange(42, 2, 40, 1)]).build());
  sh.setConditionalFormatRules(rules);
  sh.setFrozenRows(3);
  return sh;
}

function buildGuide_(ss) {
  const sh = tab_(ss, 'GUIDE_ID', TAB.guide);
  resetSheet_(sh, 60, 4);
  sh.setHiddenGridlines(true);
  [22, 46, 720, 22].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, 60, 4).setFontFamily(FONT).setFontColor(BRAND.ink).setVerticalAlignment('middle').setWrap(true);
  banner_(sh, 2, 2, 2, '📖 How to use this sheet', 'Five minutes a day turns website visitors into happy customers.');
  const email = String(cfg_('email') || DEFAULT_ALERT_EMAIL);
  const lines = [
    ['h', '✨ What happens by itself'],
    ['🌐', 'When someone taps "Call me back" or "Chat on WhatsApp" on the website, a new row appears in 📋 Enquiries within seconds.'],
    ['📧', 'An alert email goes to ' + email + ' with one-tap Call and WhatsApp buttons.'],
    ['☀️', 'Every morning at ' + SUMMARY_HOUR + ' am you get a summary: who to call, follow-ups due and visits today (only on days with something to do).'],
    ['🔥', 'Each enquiry gets a Priority: Hot when the visit is within a week, it is a villa or office, they want full home automation, or they picked 3 or more products.'],
    ['h', '📞 Your daily routine'],
    ['1', 'Open 🔔 Today. Call everyone under "Call these new enquiries first". Fast calls win jobs.'],
    ['2', 'After each call, change 🚦 Status in 📋 Enquiries (tap the cell, pick from the list). The sheet stamps the time and fills in the next follow-up date for you.'],
    ['3', 'Write what the customer said in 📝 Team notes. Pick who owns it in 🙋 Assigned to. Add the ₹ Quote when you send one.'],
    ['4', 'Go through "Follow-ups due". When a deal closes, choose ✅ Won and enjoy the celebration 🎉.'],
    ['5', 'Glance at 🏠 Dashboard to see how the week and month are going.'],
    ['h', '🎨 What the colours mean'],
    ['🟥', 'Red follow-up date: overdue. Red 🆕 New: waiting more than a day for a call.'],
    ['🟨', 'Amber follow-up date: due today.'],
    ['🟩', 'Green row: won. Grey crossed-out row: lost.'],
    ['🟧', '🔁 Repeat: this number has enquired before. Check the earlier row.'],
    ['h', '💡 Handy tips'],
    ['💬', 'Tap 💬 Chat in any row to open WhatsApp with a ready greeting. Change the greeting in ⚙️ Settings.'],
    ['🔎', 'Use the filter buttons in the 📋 Enquiries header to show only Hot leads, one area, or one team member.'],
    ['📱', 'Install the Google Sheets app on your phone. Everything here works there too.'],
    ['🏠', 'The 🏠 AURA menu (top bar) can add a test enquiry, remove tests, email the summary now and show the website link.'],
    ['⚠️', 'Please do not rename the Status or Priority options, and keep the header row. Renaming or moving tabs is fine.']
  ];
  let r = 6;
  lines.forEach(l => {
    if (l[0] === 'h') {
      sh.setRowHeight(r, 16); r++;
      mv_(sh.getRange(r, 2, 1, 2), l[1]).setFontFamily(TITLE_FONT).setFontSize(13).setFontWeight('bold')
        .setBorder(null, null, true, null, null, null, BRAND.cyan, SpreadsheetApp.BorderStyle.SOLID);
      sh.setRowHeight(r, 32);
    } else {
      sh.getRange(r, 2).setValue(l[0]).setHorizontalAlignment('center').setFontWeight('bold').setFontColor('#0E7490');
      sh.getRange(r, 3).setValue(l[1]);
      sh.setRowHeight(r, 34);
    }
    r++;
  });
  return sh;
}

function logSheet_(ss) {
  const sh = tab_(ss, 'LOG_ID', TAB.log);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, 4).setValues([['When', 'Type', 'Detail', 'Data received']]).setFontWeight('bold');
  sh.hideSheet();
}

function welcomeEmail_(ss) {
  const to = String(cfg_('email') || DEFAULT_ALERT_EMAIL);
  const html = '<div style="background:#F3F6FA;padding:24px 12px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E3E9F0">' +
    '<div style="background:#0D1A2B;padding:24px"><div style="color:#4FDCF5;font-size:12px;letter-spacing:2px">AURA SMART HOMES</div><div style="color:#fff;font-size:22px;font-weight:bold;margin-top:6px">Your enquiries sheet is ready ✅</div></div>' +
    '<div style="padding:20px 24px;color:#0D1A2B;font-size:14px;line-height:1.6">New website enquiries will arrive here as emails like this one, with Call and WhatsApp buttons, and every morning you will get a short to-do summary.' +
    '<p style="margin:18px 0"><a href="' + ss.getUrl() + '" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#2BC6EA;color:#0D1A2B;font-weight:bold;text-decoration:none">Open the sheet</a></p>' +
    '<b>Last step:</b> in Apps Script click Deploy &gt; New deployment &gt; Web app, Execute as Me, Who has access Anyone, then send the /exec link to Claude.</div></div></div>';
  MailApp.sendEmail({ to: to, subject: '✅ Your AURA enquiries sheet is ready', htmlBody: html, body: 'Your AURA enquiries sheet is ready: ' + ss.getUrl(), name: 'AURA Enquiries' });
}

// =================================================================================
// 5) SMALL HELPERS
// =================================================================================

function book_() {
  const id = prop_('SS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (_) {} }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Run "setup" once from the Apps Script editor first.');
  return ss;
}

function enqSheet_(ss) {
  let sh = tab_(ss, 'ENQ_ID', TAB.enq);
  if (sh.getLastRow() === 0) { buildSettingsIfMissing_(ss); sh = buildEnquiries_(ss); }
  return sh;
}

function buildSettingsIfMissing_(ss) { if (!ss.getRangeByName('list_status')) buildSettings_(ss); }

// Finds a tab by its saved ID (so renaming is fine), then by name, else creates it.
function tab_(ss, key, name) {
  const id = prop_(key);
  if (id) { const s = ss.getSheets().filter(x => String(x.getSheetId()) === id)[0]; if (s) return s; }
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  setProp_(key, String(s.getSheetId()));
  return s;
}

function resetSheet_(sh, rows, cols) {
  sh.clear(); sh.clearConditionalFormatRules();
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
  const all = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns());
  all.breakApart(); all.setDataValidation(null); all.setBorder(false, false, false, false, false, false);
  sh.setFrozenRows(0); sh.setFrozenColumns(0);
}

function banner_(sh, row, col, width, title, sub) {
  sh.setRowHeight(row - 1, 12);
  const b = sh.getRange(row, col, 2, width).setBackground(BRAND.navy);
  b.setBorder(null, null, true, null, null, null, BRAND.cyan, SpreadsheetApp.BorderStyle.SOLID_THICK);
  mv_(sh.getRange(row, col, 1, width), '  ' + title).setFontFamily(TITLE_FONT).setFontSize(18).setFontWeight('bold').setFontColor('#FFFFFF');
  mv_(sh.getRange(row + 1, col, 1, width), '   ' + sub).setFontColor('#9FB3C8').setFontSize(10);
  sh.setRowHeight(row, 44); sh.setRowHeight(row + 1, 26); sh.setRowHeight(row + 2, 16);
}

function section_(sh, row, col, width, title) {
  sh.setRowHeight(row, 32);
  mv_(sh.getRange(row, col, 1, width), title).setFontFamily(TITLE_FONT).setFontSize(12).setFontWeight('bold')
    .setFontColor(BRAND.ink).setVerticalAlignment('bottom');
}

// Merge a block and write into its first cell (setValue on a block would fill every cell).
function mv_(rg, v) { rg.merge(); rg.getCell(1, 1).setValue(v); return rg; }
function mf_(rg, f) { rg.merge(); rg.getCell(1, 1).setFormula(f); return rg; }
function frame_(rg) { rg.setBorder(true, true, true, true, null, null, BRAND.line, SpreadsheetApp.BorderStyle.SOLID); }

function cfg_(k) {
  try { const r = book_().getRangeByName('cfg_' + k); return r ? r.getValue() : ''; } catch (_) { return ''; }
}

function log_(type, detail, data) {
  try {
    const ss = book_(), sh = tab_(ss, 'LOG_ID', TAB.log);
    sh.appendRow([new Date(), type, String(detail).slice(0, 2000), String(data || '').slice(0, 5000)]);
  } catch (_) { console.error(type + ': ' + detail); }
}

function toast_(msg, title, sec) { try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || 'AURA', sec || 5); } catch (_) { console.log(msg); } }
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
// Midnight in India time, whatever time zone the script itself runs in.
function startOfDay_(d) { return new Date(Utilities.formatDate(new Date(d), TIME_ZONE, 'yyyy-MM-dd') + 'T00:00:00+05:30'); }
function ordinal_(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function colLetter_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // never let form text run as a formula
  return s;
}
