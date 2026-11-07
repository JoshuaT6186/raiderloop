/**
 * Flyer on the web (Firebase Hosting → this one function):
 *   /s/:id      shared event/plan/deal page with link previews
 *   /c/:handle  public Connect card (only fields set to "Everyone")
 *   /g/:code    group invite        /d/:id   Flyer Drop link
 *   /p/:id      plan poll (vote on the web, no app needed)
 *   /q/:code    office hours queue  /t/:code TV pairing link
 *   /poster/:id printable event poster with a QR code
 *   /wallet/:token  Apple Wallet pass (WALLET_ENABLED=true)
 *   /sms        Text Flyer webhook (TWILIO_ENABLED=true)
 *   /ext/deals  browser extension lookup (JSON, CORS)
 *   /oauth/:provider  sign-in hand-off back into the app
 *   /.well-known/apple-app-site-association  universal links
 * The TV page itself is static: hosting/present/index.html.
 */
const path = require('path');
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const C = require('./common');
const { visibleCard } = require('./lib/card');
const { extensionLookup } = require('./lib/ext');
const { runPilot } = require('./lib/pilot');

const { db, FieldValue, clean } = C;
const WALLET_ON = process.env.WALLET_ENABLED === 'true';
const TWILIO_ON = process.env.TWILIO_ENABLED === 'true';
const BUNDLE_ID = 'com.joshuat8808.flyer';

const secrets = [C.ANTHROPIC_API_KEY, C.TAVILY_API_KEY, ...C.backupAISecrets];
let WALLET = null; let TWILIO_AUTH_TOKEN = null;
if (WALLET_ON) {
  WALLET = { cert: defineSecret('WALLET_SIGNER_CERT'), key: defineSecret('WALLET_SIGNER_KEY'), pass: defineSecret('WALLET_SIGNER_PASSPHRASE'), wwdr: defineSecret('WALLET_WWDR') };
  secrets.push(WALLET.cert, WALLET.key, WALLET.pass, WALLET.wwdr);
}
if (TWILIO_ON) { TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN'); secrets.push(TWILIO_AUTH_TOKEN); }

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const appStoreUrl = () => process.env.APP_STORE_URL || 'https://apps.apple.com/us/search?term=Flyer%20Campus%20Life';
const ipHash = (req, extra = '') => crypto.createHash('sha256').update(`${req.ip || req.get('x-forwarded-for') || 'x'}|${extra}`).digest('hex').slice(0, 24);

function page({ title, desc = '', img = '', body, openPath = '', noindex = true }) {
  const base = C.shareBase();
  const ogImg = img || `${base}/icon.png`;
  const open = openPath ? `flyer://${openPath.replace(/^\//, '')}` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Flyer</title>
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(ogImg)}">
<meta property="og:site_name" content="Flyer"><meta name="twitter:card" content="summary_large_image">
${openPath ? `<meta name="apple-itunes-app" content="app-id=${esc(process.env.APP_STORE_ID || '')}, app-argument=${esc(base + openPath)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="/favicon.png"><link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;700;800&family=Permanent+Marker&display=swap" rel="stylesheet">
<style>
:root{--paper:#FBF7EC;--rule:#CFE0F2;--margin:#F2B3AD;--ink:#1F2A44;--soft:#4B5571;--accent:#2F5DA8;--yellow:#FFEB85;--pink:#FFC8D5;--blue:#BFE3F8;--green:#CDEDB5;--card:#FFFDF7}
@media (prefers-color-scheme: dark){:root{--paper:#1E2A25;--rule:rgba(255,255,255,.05);--margin:rgba(255,138,128,.22);--ink:#F4F1E6;--soft:#CFCBBD;--accent:#9CCBFF;--card:#26342E}}
*{box-sizing:border-box}body{margin:0;font-family:Nunito,system-ui,sans-serif;color:var(--ink);background:var(--paper);background-image:repeating-linear-gradient(transparent 0 29px,var(--rule) 29px 30px);min-height:100vh}
.wrap{max-width:560px;margin:0 auto;padding:28px 18px 60px;position:relative}.wrap:before{content:"";position:fixed;left:30px;top:0;bottom:0;width:2px;background:var(--margin)}
h1{font-family:'Permanent Marker',cursive;font-size:34px;margin:8px 0 2px;line-height:1.15}.hand{font-family:Caveat,cursive;font-size:24px;color:var(--soft)}
.note{background:var(--yellow);color:#1F2A44;padding:18px;border-radius:3px 3px 16px 3px;box-shadow:0 3px 10px rgba(0,0,0,.12);transform:rotate(-.6deg);margin:18px 0;position:relative}
.note.pink{background:var(--pink)}.note.blue{background:var(--blue)}.note.green{background:var(--green)}
.tape{position:absolute;top:-10px;left:50%;width:70px;height:20px;margin-left:-35px;background:rgba(255,255,255,.6);transform:rotate(-3deg)}
.btn{display:inline-block;background:#2F5DA8;color:#fff;font-weight:800;padding:14px 20px;border-radius:14px;border:2px solid #2F5DA8;border-bottom-width:4px;text-decoration:none;margin:6px 8px 0 0;font-size:16px;cursor:pointer}
.btn.ghost{background:transparent;color:var(--ink);border-color:rgba(127,127,127,.5)}.small{font-size:13px;color:var(--soft)}
.row{display:flex;gap:10px;align-items:center}.pill{display:inline-block;padding:4px 10px;border-radius:999px;background:var(--card);border:1.5px solid rgba(127,127,127,.35);margin:4px 6px 0 0;font-size:13px;font-weight:700}
img.hero{width:100%;border-radius:6px;margin:10px 0}input,select{font:inherit;padding:12px;border-radius:10px;border:1.5px solid rgba(127,127,127,.5);width:100%;margin:6px 0;background:var(--card);color:var(--ink)}
footer{margin-top:40px}.logo{font-family:'Permanent Marker',cursive;font-size:20px}
</style></head><body><div class="wrap">
<div class="row"><span class="logo">✈︎ Flyer</span></div>
${body}
${openPath ? `<p><a class="btn" href="${esc(open)}">Open in Flyer</a><a class="btn ghost" href="${esc(appStoreUrl())}">Get Flyer</a></p>` : ''}
<footer class="small">Flyer is an independent, student-built campus app by Eternity Works. It isn't affiliated with any university. <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></footer>
</div></body></html>`;
}

function notFound(res, what = 'That link has expired or was removed.') {
  res.status(404).send(page({ title: 'Not found', body: `<h1>Hmm.</h1><p class="hand">${esc(what)}</p>`, openPath: '' }));
}

/* ---------- routes ---------- */
async function sharePage(req, res, id) {
  const s = await db.doc(`shares/${clean(id, 20)}`).get();
  if (!s.exists) return notFound(res);
  const { kind, data } = s.data();
  const desc = [data.when, data.where].filter(Boolean).join(' · ') || data.desc || 'Shared from Flyer';
  const label = { event: 'Event', plan: 'Plan', deal: 'Student deal', place: 'Place', tip: 'Good to know', group: 'Group', card: 'Connect card', post: 'Post', queue: 'Office hours' }[kind] || 'Shared';
  const body = `<p class="hand">${esc(label)}</p><h1>${esc(data.title)}</h1>
${data.img ? `<img class="hero" src="${esc(data.img)}" alt="">` : ''}
<div class="note"><div class="tape"></div>
${data.when ? `<p><b>When:</b> ${esc(data.when)}</p>` : ''}${data.where ? `<p><b>Where:</b> ${esc(data.where)}</p>` : ''}
${data.desc ? `<p>${esc(data.desc)}</p>` : ''}${data.by ? `<p class="small">From ${esc(data.by)}</p>` : ''}
${data.url ? `<p><a href="${esc(data.url)}" rel="noopener">More info →</a></p>` : ''}</div>`;
  res.set('Cache-Control', 'public, max-age=300').send(page({ title: data.title, desc, img: data.img, body, openPath: `/s/${id}` }));
}

async function cardPage(req, res, handle) {
  const s = await db.doc(`publicCards/${clean(handle, 30).toLowerCase()}`).get();
  if (!s.exists) return notFound(res, "We couldn't find that card.");
  const c = s.data();
  const links = (c.links || []).map((l) => `<a class="pill" href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a>`).join('');
  const orgs = (c.orgs || []).map((o) => `<span class="pill">${esc(o.name)}</span>`).join('');
  const body = `<div class="note ${esc(c.color || 'yellow')}"><div class="tape"></div>
<h1 style="margin-top:0">${esc(c.name)}</h1><p class="hand" style="color:#4B5571">@${esc(c.handle)}</p>
${c.major ? `<p><b>${esc(c.major)}</b>${c.classYear ? ` · ${esc(c.classYear)}` : ''}</p>` : ''}${c.headline ? `<p>${esc(c.headline)}</p>` : ''}
${orgs ? `<p>${orgs}</p>` : ''}${links ? `<p>${links}</p>` : ''}</div>
<p class="small">Only what ${esc((c.name || '').split(' ')[0])} chose to show to everyone is on this page. Friends on Flyer see a bit more.</p>`;
  res.send(page({ title: `${c.name} on Flyer`, desc: [c.major, c.headline].filter(Boolean).join(' · '), body, openPath: `/c/${c.handle}` }));
}

async function groupPage(req, res, code) {
  const q = await db.collection('groups').where('code', '==', clean(code, 10).toUpperCase()).limit(1).get();
  if (q.empty) return notFound(res, 'That group code is wrong or the group was deleted.');
  const g = q.docs[0].data();
  const body = `<p class="hand">Group invite</p><h1>${esc(g.name)}</h1><div class="note blue"><div class="tape"></div>
<p>${g.members.length} ${g.members.length === 1 ? 'person' : 'people'}${g.course ? ` · ${esc(g.course)}` : ''}</p><p>Open Flyer to join. Group code: <b>${esc(g.code)}</b></p></div>`;
  res.send(page({ title: `Join ${g.name}`, desc: 'A Group Space on Flyer', body, openPath: `/g/${g.code}` }));
}

async function dropPage(req, res, id) {
  const s = await db.doc(`drops/${clean(id, 20).toUpperCase()}`).get();
  if (!s.exists || new Date(s.data().expiresAt) < new Date()) return notFound(res, 'That drop expired.');
  const d = s.data();
  const body = `<p class="hand">Flyer Drop</p><h1>${esc(d.payload.title || 'Something for you')}</h1><div class="note"><div class="tape"></div>
<p>${esc(d.fromName)} shared this with you. Open Flyer to get it.</p></div>`;
  res.send(page({ title: d.payload.title || 'Flyer Drop', desc: `From ${d.fromName}`, body, openPath: `/d/${s.id}` }));
}

async function planPage(req, res, id) {
  const ref = db.doc(`plans/${clean(id, 20)}`);
  const s = await ref.get();
  if (!s.exists) return notFound(res, 'That plan is gone.');
  const p = s.data();
  const open = p.open && new Date(p.closesAt) > new Date();
  if (req.method === 'POST' && open) {
    const opt = clean(req.body?.option, 6); const name = clean(req.body?.name, 30) || 'Someone';
    const mark = db.doc(`webVotes/${s.id}_${ipHash(req, s.id)}`);
    if (p.options.some((o) => o.id === opt) && !(await mark.get()).exists) {
      await mark.set({ at: FieldValue.serverTimestamp() });
      await ref.update({ [`webVotes.${opt}`]: FieldValue.arrayUnion(name) });
      await C.pushTo([p.owner], { title: `${name} voted on your plan`, body: p.title, data: { route: 'plan', id: s.id }, category: 'plans' });
    }
    return res.redirect(303, `/p/${s.id}?voted=1`);
  }
  const fresh = (await ref.get()).data();
  const total = (o) => (fresh.votes?.[o.id] || []).length + (fresh.webVotes?.[o.id] || []).length;
  const opts = fresh.options.map((o) => `<label class="pill" style="display:block;padding:12px;margin:8px 0"><input type="radio" name="option" value="${esc(o.id)}" style="width:auto;margin-right:8px" required>${esc(o.label)} <span class="small">· ${total(o)}</span></label>`).join('');
  const voted = req.query.voted ? '<p class="hand">Thanks! Your vote is in.</p>' : '';
  const body = `<p class="hand">${esc(fresh.ownerName)} asks</p><h1>${esc(fresh.title)}</h1>${voted}
<div class="note green"><div class="tape"></div>${open ? `<form method="post">${opts}<input name="name" placeholder="Your first name" maxlength="30"><button class="btn" type="submit">Vote</button></form>` : `<p>Voting closed.</p>${fresh.options.map((o) => `<p>${esc(o.label)}: <b>${total(o)}</b></p>`).join('')}`}</div>`;
  res.send(page({ title: fresh.title, desc: `${fresh.ownerName} asks. Tap to vote.`, body, openPath: `/p/${s.id}` }));
}

async function queuePage(req, res, code) {
  const s = await db.doc(`queues/${clean(code, 10).toUpperCase()}`).get();
  if (!s.exists) return notFound(res, "That queue isn't open.");
  const q = s.data();
  const body = `<p class="hand">Office hours</p><h1>${esc(q.title)}</h1><div class="note pink"><div class="tape"></div>
<p>${esc(q.hostName)}${q.course ? ` · ${esc(q.course)}` : ''}${q.place ? ` · ${esc(q.place)}` : ''}</p>
<p>${q.open ? `${(q.waiting || []).length} waiting right now. Open Flyer to get in line. Code <b>${esc(s.id)}</b>` : 'This queue is closed.'}</p></div>`;
  res.send(page({ title: `${q.title} queue`, desc: `${q.hostName} office hours`, body, openPath: `/q/${s.id}` }));
}

function tvPage(req, res, code) {
  const body = `<h1>Present on this screen</h1><div class="note"><div class="tape"></div><p>Open Flyer on your phone to send your slides here. Screen code <b>${esc(clean(code, 10).toUpperCase())}</b></p></div>`;
  res.send(page({ title: 'Present with Flyer', body, openPath: `/t/${clean(code, 10).toUpperCase()}` }));
}

async function posterPage(req, res, id) {
  const s = await db.doc(`publicPosts/${clean(id, 20)}`).get();
  if (!s.exists || s.data().status !== 'live' || s.data().kind !== 'event') return notFound(res, 'That event is gone.');
  const p = s.data();
  const when = p.when ? new Date(p.when).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) : '';
  const shareUrl = `${C.shareBase()}/poster/${s.id}`;
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.title)} poster</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@700;800&family=Permanent+Marker&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<style>@page{size:letter;margin:0.5in}body{font-family:Nunito,sans-serif;color:#1F2A44;margin:0}
.p{border:6px solid #1F2A44;border-radius:18px;padding:36px;min-height:9.4in;position:relative;background:#FFEB85}
h1{font-family:'Permanent Marker',cursive;font-size:64px;line-height:1.05;margin:0 0 18px}.w{font-size:28px;font-weight:800}.b{font-size:22px;margin-top:18px}
.qr{position:absolute;right:36px;bottom:36px;text-align:center;font-family:Caveat,cursive;font-size:28px}.org{font-family:Caveat,cursive;font-size:34px}
.no-print{margin:16px}@media print{.no-print{display:none}}</style></head><body>
<div class="no-print"><button onclick="window.print()">Print this poster</button></div>
<div class="p"><div class="org">${esc(p.verified ? p.orgName : 'Flyer event')}</div><h1>${esc(p.title)}</h1>
<div class="w">${esc(when)}</div><div class="w">${esc(p.place?.name || '')}</div>${p.body ? `<div class="b">${esc(p.body)}</div>` : ''}
<div class="qr"><div id="q"></div>scan to save it in Flyer</div></div>
<script>var q=qrcode(0,'M');q.addData(${JSON.stringify(`${C.shareBase()}/e/${s.id}`)});q.make();document.getElementById('q').innerHTML=q.createSvgTag({cellSize:7,margin:2});</script>
</body></html>`);
  return shareUrl;
}

async function eventPostPage(req, res, id) {
  const s = await db.doc(`publicPosts/${clean(id, 20)}`).get();
  if (!s.exists || s.data().status !== 'live') return notFound(res, 'That event is gone.');
  const p = s.data();
  const when = p.when ? new Date(p.when).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) : '';
  const body = `<p class="hand">${p.verified ? esc(p.orgName) : 'Event on Flyer'}</p><h1>${esc(p.title)}</h1>${p.photoUrl ? `<img class="hero" src="${esc(p.photoUrl)}" alt="">` : ''}
<div class="note"><div class="tape"></div>${when ? `<p><b>When:</b> ${esc(when)}</p>` : ''}${p.place?.name ? `<p><b>Where:</b> ${esc(p.place.name)}</p>` : ''}${p.body ? `<p>${esc(p.body)}</p>` : ''}</div>`;
  res.send(page({ title: p.title, desc: [when, p.place?.name].filter(Boolean).join(' · '), img: p.photoUrl, body, openPath: `/e/${s.id}` }));
}

function aasa(res) {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return res.status(404).json({ error: 'APPLE_TEAM_ID not set' });
  res.set('Content-Type', 'application/json').send(JSON.stringify({
    applinks: { details: [{ appIDs: [`${team}.${BUNDLE_ID}`], components: ['/s/*', '/c/*', '/g/*', '/d/*', '/p/*', '/q/*', '/t/*', '/e/*'].map((p) => ({ '/': p })) }] },
  }));
}

async function walletPass(req, res, token) {
  if (!WALLET_ON) return notFound(res, "Apple Wallet isn't set up yet.");
  const t = await db.doc(`walletTokens/${clean(token, 20)}`).get();
  if (!t.exists || t.data().exp < Date.now()) return notFound(res, 'That Wallet link expired. Tap "Add to Apple Wallet" again.');
  await t.ref.delete();
  const { uid } = t.data();
  const base = await C.basicCard(uid);
  const card = (await db.doc(`cards/${uid}`).get()).data() || {};
  const vis = visibleCard(card, 0);
  // eslint-disable-next-line global-require
  const { PKPass } = require('passkit-generator');
  const pass = await PKPass.from({
    model: path.join(__dirname, '..', 'wallet', 'flyer.pass'),
    certificates: {
      wwdr: WALLET.wwdr.value(), signerCert: WALLET.cert.value(), signerKey: WALLET.key.value(),
      ...(WALLET.pass.value() && WALLET.pass.value() !== 'none' ? { signerKeyPassphrase: WALLET.pass.value() } : {}),
    },
  }, {
    serialNumber: `${uid}-${Date.now()}`, passTypeIdentifier: process.env.WALLET_PASS_TYPE_ID, teamIdentifier: process.env.APPLE_TEAM_ID,
    organizationName: 'Flyer', description: 'Flyer Connect card', logoText: 'Flyer',
  });
  pass.primaryFields.push({ key: 'name', label: 'NAME', value: base.name || 'Flyer student' });
  if (vis.major) pass.secondaryFields.push({ key: 'major', label: 'MAJOR', value: vis.major });
  if (vis.classYear) pass.secondaryFields.push({ key: 'year', label: 'CLASS', value: vis.classYear });
  if (vis.headline) pass.auxiliaryFields.push({ key: 'about', label: 'ABOUT', value: vis.headline });
  pass.backFields.push({ key: 'handle', label: 'Flyer code', value: `@${base.handle}` });
  (vis.links || []).forEach((l, i) => pass.backFields.push({ key: `link${i}`, label: l.label, value: l.url }));
  pass.setBarcodes({ message: `${C.shareBase()}/c/${base.handle}`, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1', altText: `@${base.handle}` });
  res.set('Content-Type', 'application/vnd.apple.pkpass').set('Content-Disposition', 'attachment; filename="flyer-card.pkpass"').send(pass.getAsBuffer());
}

function twilioValid(req) {
  const sig = req.get('X-Twilio-Signature') || '';
  const url = `${C.shareBase()}/sms`;
  const params = req.body || {};
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN.value()).update(Buffer.from(data, 'utf-8')).digest('base64');
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
const twiml = (text) => `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc(text).slice(0, 1500)}</Message></Response>`;

async function smsWebhook(req, res) {
  if (!TWILIO_ON) return res.status(404).send('off');
  if (!twilioValid(req)) return res.status(403).send('bad signature');
  res.set('Content-Type', 'text/xml');
  const from = clean(req.body?.From, 20); const body = clean(req.body?.Body, 600);
  const link = await db.doc(`phones/${from}`).get();
  if (!link.exists) return res.send(twiml("This number isn't linked to Flyer yet. In the app: You → Connections → Text Flyer."));
  const uid = link.data().uid;
  const priv = (await db.doc(`private/${uid}`).get()).data() || {};
  try {
    const out = await runPilot({ uid, question: body, context: priv.smsContext || 'No schedule shared.', channel: 'sms' });
    return res.send(twiml(out.text));
  } catch (e) {
    return res.send(twiml(e.message && e.code === 'resource-exhausted' ? e.message : "Pilot couldn't answer right now. Try again in a bit."));
  }
}

async function extDeals(req, res) {
  res.set('Access-Control-Allow-Origin', '*').set('Access-Control-Allow-Methods', 'GET').set('Cache-Control', 'public, max-age=3600');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  const domain = clean(req.query.domain, 120);
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`extIps/${ipHash(req, day)}`);
  const n = ((await ref.get()).data() || {}).n || 0;
  if (n > 60) return res.status(429).json({ error: 'Too many lookups today. Try again tomorrow.' });
  await ref.set({ n: FieldValue.increment(1), day }, { merge: true });
  try {
    return res.json(await extensionLookup(domain));
  } catch (e) {
    return res.status(503).json({ error: 'Flyer is busy right now. Try again later.' });
  }
}

function oauthBounce(req, res, provider) {
  const qs = new URLSearchParams(req.query).toString();
  const target = `flyer://oauth/${encodeURIComponent(clean(provider, 20))}?${qs}`;
  res.send(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(target)}"><p style="font-family:sans-serif">Returning to Flyer… <a href="${esc(target)}">Tap here</a> if nothing happens.</p>`);
}

function landing(res) {
  const body = `<h1>Your campus, folded into one app.</h1><p class="hand">Classes, events, friends, jobs, and everything your university has, without the 12 tabs.</p>
<div class="note"><div class="tape"></div><p>Flyer is a free iPhone app made by a Texas Tech student.</p></div>`;
  res.set('Cache-Control', 'public, max-age=3600').send(page({ title: 'Flyer', desc: 'Your campus, folded into one app.', body, openPath: '', noindex: false }).replace('</p>\n<footer', `</p><p><a class="btn" href="${esc(appStoreUrl())}">Get Flyer</a></p>\n<footer`));
}

/* An iMessage poll made in the Flyer drawer lives inside the message
   itself. Friends without Flyer who tap it land here and see the
   question and options (read-only), with a link to get the app. */
function messagesPollPage(req, res) {
  const q = clean(req.query.q, 140);
  const raw = req.query.o;
  const opts = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((o) => clean(o, 80)).filter(Boolean).slice(0, 6);
  const votes = (Array.isArray(req.query.v) ? req.query.v : req.query.v ? [req.query.v] : []).map((v) => Number(String(v).split(':')[1])).filter((n) => Number.isInteger(n) && n >= 0 && n < opts.length);
  const count = opts.map((_, i) => votes.filter((v) => v === i).length);
  if (!q || opts.length < 2) return notFound(res, "That poll isn't readable outside Messages.");
  const body = `<p class="hand">A plan poll from Messages</p><h1>${esc(q)}</h1>
<div class="note"><div class="tape"></div>${opts.map((o, i) => `<p><b>${esc(o)}</b> · ${count[i]} ${count[i] === 1 ? 'vote' : 'votes'}</p>`).join('')}</div>
<p class="small">Votes happen in Messages with the Flyer app drawer. Get Flyer to vote and make your own.</p>
<p><a class="btn" href="${esc(appStoreUrl())}">Get Flyer</a></p>`;
  res.set('Cache-Control', 'public, max-age=300').send(page({ title: q, desc: opts.join(' · '), body }));
}

/* ---------- Website waitlist (flyer site home page) ----------
   Email only, one entry per address, at most 5 tries per IP a day. */
async function waitlist(req, res) {
  res.set('Cache-Control', 'no-store');
  const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: 'That email doesn\'t look right.' });
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const ipKey = require('crypto').createHash('sha256').update(`${ip}|${day}`).digest('hex').slice(0, 32);
  const lim = db.doc(`waitlistLimits/${ipKey}`);
  const snap = await lim.get();
  if (snap.exists && (snap.data().n || 0) >= 5) return res.status(429).json({ ok: false, error: 'Too many tries today. Try again tomorrow.' });
  await lim.set({ n: (snap.exists ? snap.data().n || 0 : 0) + 1, day }, { merge: true });
  const id = require('crypto').createHash('sha256').update(email).digest('hex').slice(0, 40);
  await db.doc(`waitlist/${id}`).set({ email, source: clean((req.body && req.body.source) || 'site', 40), at: new Date().toISOString() }, { merge: true });
  return res.json({ ok: true });
}

exports.web = onRequest({ secrets, memory: '512MiB', timeoutSeconds: 60, maxInstances: 20 }, async (req, res) => {
  try {
    const parts = req.path.split('/').filter(Boolean);
    const [a, b] = parts;
    if (req.path === '/.well-known/apple-app-site-association' || req.path === '/apple-app-site-association') return aasa(res);
    if (!a) return landing(res);
    if (a === 's' && b) return sharePage(req, res, b);
    if (a === 'c' && b) return cardPage(req, res, b);
    if (a === 'g' && b) return groupPage(req, res, b);
    if (a === 'd' && b) return dropPage(req, res, b);
    if (a === 'p' && b) return planPage(req, res, b);
    if (a === 'q' && b) return queuePage(req, res, b);
    if (a === 't' && b) return tvPage(req, res, b);
    if (a === 'e' && b) return eventPostPage(req, res, b);
    if (a === 'poster' && b) return posterPage(req, res, b);
    if (a === 'wallet' && b) return walletPass(req, res, b);
    if (a === 'sms' && req.method === 'POST') return smsWebhook(req, res);
    if (a === 'ext' && b === 'deals') return extDeals(req, res);
    if (a === 'oauth' && b) return oauthBounce(req, res, b);
    if (a === 'm') return messagesPollPage(req, res);
    if (a === 'api' && b === 'waitlist' && req.method === 'POST') return waitlist(req, res);
    return notFound(res, "That page doesn't exist.");
  } catch (e) {
    console.error('web error', e);
    return res.status(500).send(page({ title: 'Something went wrong', body: '<h1>Oops.</h1><p class="hand">Something went wrong on our end. Try again in a bit.</p>' }));
  }
});
