/**
 * Tools that read things for you:
 *   • Flyer scanner: photo of a paper flyer → an event you can save
 *   • Syllabus drop: a syllabus PDF or photo → dated assignments/exams
 *   • Graduation roadmap + Major Explorer (from the official catalog)
 *   • Around Lubbock (things to do off campus)
 *   • Canva connection (server half of the sign-in; needs your keys)
 *   • Text Flyer (link a phone number; needs a Twilio account)
 *
 * The browser extension lookup lives here too (used by web.js).
 */
const { onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const crypto = require('crypto');
const C = require('./common');

const { db, FieldValue, HttpsError, clean, ANTHROPIC_API_KEY, TAVILY_API_KEY } = C;
const BOTH = [ANTHROPIC_API_KEY, TAVILY_API_KEY];
const DAY = 24 * 3600000;

/* ---------------- Flyer scanner ---------------- */
exports.scanFlyer = onCall({ ...C.callOpts([ANTHROPIC_API_KEY]), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request);
  const { imageBase64, mediaType } = request.data || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') throw new HttpsError('invalid-argument', 'No photo was sent.');
  if (imageBase64.length > 7000000) throw new HttpsError('invalid-argument', 'That photo is too large.');
  const type = ['image/png', 'image/jpeg', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg';
  await C.takeQuota(uid, 'flyerScan', 10, "You've scanned 10 flyers today. That's the daily limit.");
  const today = new Date().toISOString().slice(0, 10);
  const system = `Read this photo of a paper flyer or poster for an event. Today is ${today}.
Return ONLY JSON:
{"isEvent": boolean, "title": string, "date": "YYYY-MM-DD" or "", "time": "7:00 PM" or "", "endTime": "" , "location": string, "host": string, "description": string (max 300 chars, your own words), "price": string, "url": string (only if printed), "rsvp": string}
If a date has no year, use the next time that date happens on or after today. Leave a field empty if it isn't printed. Never guess a date, time or place. If it isn't an event flyer, set isEvent false.`;
  const out = await C.claudeText({ system, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: type, data: imageBase64 } }, { type: 'text', text: 'Read the flyer.' }] }], maxTokens: 700 });
  const j = C.parseJsonObject(out) || { isEvent: false };
  const ev = {
    isEvent: !!j.isEvent, title: clean(j.title, 140), date: /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : '', time: clean(j.time, 12), endTime: clean(j.endTime, 12),
    location: clean(j.location, 140), host: clean(j.host, 100), description: clean(j.description, 320), price: clean(j.price, 60), url: C.cleanUrl(j.url), rsvp: clean(j.rsvp, 140),
  };
  return { event: ev };
});

/* ---------------- Syllabus drop ---------------- */
exports.parseSyllabus = onCall({ ...C.callOpts([ANTHROPIC_API_KEY]), memory: '1GiB', timeoutSeconds: 120 }, async (request) => {
  const uid = C.requireAuth(request);
  let { fileBase64, mediaType } = request.data || {};
  if (request.data?.uploadPath) {
    const up = await C.readUpload(uid, request.data.uploadPath, { maxBytes: 20 * 1024 * 1024, types: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] });
    fileBase64 = up.buf.toString('base64'); mediaType = up.contentType;
    await up.file.delete().catch(() => {});
  }
  if (!fileBase64 || typeof fileBase64 !== 'string') throw new HttpsError('invalid-argument', 'No file was sent.');
  if (fileBase64.length > 28000000) throw new HttpsError('invalid-argument', 'That file is too large. Try a smaller PDF or a few photos.');
  await C.takeQuota(uid, 'syllabus', 6, "You've read 6 syllabi today. Try again tomorrow.");
  const term = clean(request.data?.term, 60) || 'the current semester';
  const isPdf = mediaType === 'application/pdf';
  const block = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: ['image/png', 'image/jpeg', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg', data: fileBase64 } };
  const system = `You read a college course syllabus for ${term} (today is ${new Date().toISOString().slice(0, 10)}).
Return ONLY JSON:
{"course": "SUBJ 1234" or "", "title": string, "instructor": string, "officeHours": string, "items": [{"title": string, "type": "exam|quiz|assignment|project|paper|lab|presentation|other", "due": "YYYY-MM-DD", "time": "11:59 PM" or "", "weight": "15%" or ""}]}
Only include graded items that have a specific date written in the syllabus. Skip weekly or "TBA" items. Use the year of the semester. Never invent a date.`;
  const out = await C.claudeText({ system, messages: [{ role: 'user', content: [block, { type: 'text', text: 'Read the syllabus.' }] }], maxTokens: 3000 });
  const j = C.parseJsonObject(out) || {};
  const items = (Array.isArray(j.items) ? j.items : []).map((i) => ({
    title: clean(i.title, 120), type: clean(i.type, 16) || 'other', due: /^\d{4}-\d{2}-\d{2}$/.test(i.due) ? i.due : '', time: clean(i.time, 12), weight: clean(i.weight, 12),
  })).filter((i) => i.title && i.due).slice(0, 80);
  return { course: clean(j.course, 16).toUpperCase(), title: clean(j.title, 120), instructor: clean(j.instructor, 100), officeHours: clean(j.officeHours, 200), items };
});

/* ---------------- Graduation roadmap + Major Explorer ---------------- */
const slug = (s) => clean(s, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

exports.getDegreePlan = onCall({ ...C.callOpts(BOTH), timeoutSeconds: 120 }, async (request) => {
  const uid = C.requireAuth(request);
  const major = clean(request.data?.major, 80);
  if (!major) throw new HttpsError('invalid-argument', 'Pick a major.');
  const key = `degree2:${slug(major)}`;
  const hit = await C.getCached(key, 30 * DAY);
  if (hit) return { plan: hit, cached: true };
  await C.takeQuota(uid, 'lookups', 80);
  const res = await C.tavilySearch({ query: `Texas Tech University ${major} bachelor degree plan required courses catalog`, maxResults: 6 });
  const urls = (res.results || []).map((r) => r.url).filter((u) => /ttu\.edu/.test(u)).slice(0, 2);
  const ext = urls.length ? await C.tavilyExtract(urls) : { results: [] };
  const sourceText = [...(ext.results || []).map((r) => `SOURCE ${r.url}\n${String(r.raw_content || '').slice(0, 14000)}`), C.resultsText(res)].join('\n\n=====\n\n');
  const system = `You extract an official degree plan from Texas Tech University pages. Only use the sources given. If the sources don't contain the plan, return {"found": false}.
Return ONLY JSON: {"found": true, "major": string, "degree": "BS|BA|BBA|...", "college": string, "totalHours": number, "sourceUrl": string, "notes": string (one short sentence), "groups": [{"name": "e.g. Major core, Math and science, Core curriculum, Electives", "hours": number or null, "courses": [{"code": "SUBJ 1234", "title": string, "hours": number or null}]}]}`;
  const out = await C.claudeText({ system, messages: [{ role: 'user', content: `Major: ${major}\n\n${sourceText.slice(0, 40000)}` }], maxTokens: 3500 });
  const j = C.parseJsonObject(out);
  if (!j || !j.found) { await C.setCached(key, { found: false, major }); return { plan: { found: false, major }, cached: false }; }
  const plan = {
    found: true, major: clean(j.major, 80) || major, degree: clean(j.degree, 12), college: clean(j.college, 100), totalHours: Number(j.totalHours) || null,
    sourceUrl: C.cleanUrl(j.sourceUrl) || urls[0] || '', notes: clean(j.notes, 200),
    groups: (j.groups || []).slice(0, 14).map((g) => ({ name: clean(g.name, 80), hours: Number(g.hours) || null, courses: (g.courses || []).slice(0, 40).map((c) => ({ code: clean(c.code, 16).toUpperCase(), title: clean(c.title, 100), hours: Number(c.hours) || null })).filter((c) => c.code || c.title) })),
    checkedAt: new Date().toISOString(),
  };
  await C.setCached(key, plan);
  return { plan, cached: false };
});

exports.getMajor = onCall(C.callOpts(BOTH), async (request) => {
  const uid = C.requireAuth(request);
  const name = clean(request.data?.name, 80);
  if (!name) throw new HttpsError('invalid-argument', 'Pick a major.');
  const key = `major2:${slug(name)}`;
  const hit = await C.getCached(key, 30 * DAY);
  if (hit) return { major: hit, cached: true };
  await C.takeQuota(uid, 'lookups', 80);
  const res = await C.tavilySearch({ query: `Texas Tech University ${name} major undergraduate program overview`, maxResults: 6 });
  const system = `Describe a Texas Tech University undergraduate major using ONLY the search results. If the results don't describe it, return {"found": false}.
Return ONLY JSON: {"found": true, "name": string, "college": string, "summary": string (2-3 sentences, plain), "youllStudy": [string] (up to 5 topics or course names that appear in the sources), "careers": [string] (up to 5, only if the sources list them), "sourceUrl": string, "advisingUrl": string or ""}`;
  const out = await C.claudeText({ system, messages: [{ role: 'user', content: `Major: ${name}\n\n${C.resultsText(res).slice(0, 20000)}` }], maxTokens: 900 });
  const j = C.parseJsonObject(out) || { found: false };
  const major = j.found ? {
    found: true, name: clean(j.name, 80) || name, college: clean(j.college, 100), summary: clean(j.summary, 600),
    youllStudy: (j.youllStudy || []).map((x) => clean(x, 80)).slice(0, 5), careers: (j.careers || []).map((x) => clean(x, 60)).slice(0, 5),
    sourceUrl: C.cleanUrl(j.sourceUrl), advisingUrl: C.cleanUrl(j.advisingUrl), checkedAt: new Date().toISOString(),
  } : { found: false, name };
  await C.setCached(key, major);
  return { major, cached: false };
});

/* ---------------- Around Lubbock ---------------- */
exports.getAround = onCall(C.callOpts(BOTH), async (request) => {
  const uid = C.requireAuth(request);
  const kind = request.data?.kind === 'places' ? 'places' : 'events';
  const { value, cached } = await C.cachedList(`around2:${kind}:${C.today()}`, 6 * 3600000, 2 * 3600000, async () => {
    await C.takeQuota(uid, 'lookups', 80);
    const query = kind === 'events'
      ? `things to do in Lubbock Texas this week events concerts ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : 'best places near Texas Tech University Lubbock students coffee food study hangout';
    const res = await C.tavilySearch({ query, maxResults: 8 });
    const system = kind === 'events'
      ? `List upcoming events in Lubbock, TX from the search results only. ${C.recencyGuard()}
Return ONLY a JSON array: [{"title": string, "when": "Fri, Nov 6 · 7 PM", "date": "YYYY-MM-DD", "where": string, "address": string, "desc": string (1 sentence), "url": string, "category": "Music|Food|Arts|Sports|Outdoors|Community|Other"}]. Max 12.`
      : `List real places in Lubbock, TX near Texas Tech that students like, from the search results only. Return ONLY a JSON array: [{"title": string, "where": "neighborhood or street", "address": string, "desc": string (1 sentence), "url": string, "category": "Coffee|Food|Study|Outdoors|Fun|Shopping|Other"}]. Max 12. Never invent a place.`;
    const out = await C.claudeText({ system, messages: [{ role: 'user', content: C.resultsText(res).slice(0, 24000) }], maxTokens: 2000 });
    return C.parseJsonArray(out).map((x) => ({
      title: clean(x.title, 120), when: clean(x.when, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : '', where: clean(x.where, 100), address: clean(x.address, 140),
      desc: clean(x.desc, 240), url: C.cleanUrl(x.url), category: clean(x.category, 20) || 'Other',
    })).filter((x) => x.title && (kind === 'places' || !x.date || x.date >= C.today())).slice(0, 12);
  });
  return { items: value, cached };
});

/* ---------------- Canva (needs CANVA_ENABLED=true + keys) ---------------- */
const CANVA_ON = process.env.CANVA_ENABLED === 'true';
if (CANVA_ON) {
  const CANVA_CLIENT_SECRET = defineSecret('CANVA_CLIENT_SECRET');
  const canvaToken = async (body) => {
    const basic = Buffer.from(`${process.env.CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET.value()}`).toString('base64');
    const r = await fetch('https://api.canva.com/rest/v1/oauth/token', { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
    if (!r.ok) { console.error('canva token', r.status, await r.text()); throw new HttpsError('internal', 'Canva sign-in failed. Try again.'); }
    return r.json();
  };
  exports.canvaExchange = onCall(C.callOpts([CANVA_CLIENT_SECRET]), async (request) => {
    const uid = C.requireAuth(request, { account: true });
    const { code, verifier, redirectUri } = request.data || {};
    const t = await canvaToken({ grant_type: 'authorization_code', code: clean(code, 2000), code_verifier: clean(verifier, 200), redirect_uri: clean(redirectUri, 300) });
    await db.doc(`private/${uid}`).set({ canva: { access: t.access_token, refresh: t.refresh_token, exp: Date.now() + (t.expires_in || 3600) * 1000 } }, { merge: true });
    return { ok: true };
  });
  exports.canvaDesigns = onCall(C.callOpts([CANVA_CLIENT_SECRET]), async (request) => {
    const uid = C.requireAuth(request, { account: true });
    const ref = db.doc(`private/${uid}`);
    const p = (await ref.get()).data() || {};
    if (!p.canva) throw new HttpsError('failed-precondition', 'Connect Canva first.');
    let { access } = p.canva;
    if (Date.now() > p.canva.exp - 60000) {
      const t = await canvaToken({ grant_type: 'refresh_token', refresh_token: p.canva.refresh });
      access = t.access_token;
      await ref.set({ canva: { access, refresh: t.refresh_token || p.canva.refresh, exp: Date.now() + (t.expires_in || 3600) * 1000 } }, { merge: true });
    }
    const r = await fetch('https://api.canva.com/rest/v1/designs?ownership=owned&sort_by=modified_descending', { headers: { Authorization: `Bearer ${access}` } });
    if (!r.ok) throw new HttpsError('internal', "Couldn't load your Canva designs.");
    const j = await r.json();
    return { designs: (j.items || []).slice(0, 40).map((d) => ({ id: d.id, title: d.title || 'Untitled design', thumb: d.thumbnail?.url || null, url: d.urls?.view_url || d.urls?.edit_url || null })) };
  });
  exports.canvaDisconnect = onCall(C.callOpts(), async (request) => {
    const uid = C.requireAuth(request);
    await db.doc(`private/${uid}`).set({ canva: FieldValue.delete() }, { merge: true });
    return { ok: true };
  });
}

/* ---------------- Text Flyer (needs TWILIO_ENABLED=true) ---------------- */
const TWILIO_ON = process.env.TWILIO_ENABLED === 'true';
const toE164 = (s) => {
  const digits = String(s || '').replace(/[^\d+]/g, '');
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  const d = digits.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
};
if (TWILIO_ON) {
  const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
  const sendSms = async (to, body) => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${TWILIO_AUTH_TOKEN.value()}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_NUMBER, Body: body }).toString(),
    });
    if (!r.ok) { console.error('twilio', r.status, await r.text()); throw new HttpsError('internal', "Couldn't send the text. Check the number and try again."); }
  };
  exports.smsStart = onCall(C.callOpts([TWILIO_AUTH_TOKEN]), async (request) => {
    const uid = C.requireAuth(request, { account: true });
    const phone = toE164(request.data?.phone);
    if (!phone) throw new HttpsError('invalid-argument', 'Enter a 10-digit US phone number.');
    await C.takeQuota(uid, 'smsStart', 5, "Try again tomorrow.");
    const code = String(crypto.randomInt(100000, 999999));
    await db.doc(`smsVerify/${uid}`).set({ phone, hash: crypto.createHash('sha256').update(code).digest('hex'), exp: Date.now() + 10 * 60000, tries: 0 });
    await sendSms(phone, `Your Flyer code is ${code}. Reply STOP to opt out.`);
    return { ok: true };
  });
  exports.smsConfirm = onCall(C.callOpts([TWILIO_AUTH_TOKEN]), async (request) => {
    const uid = C.requireAuth(request, { account: true });
    const ref = db.doc(`smsVerify/${uid}`);
    const s = await ref.get();
    if (!s.exists || s.data().exp < Date.now()) throw new HttpsError('failed-precondition', 'That code expired. Send a new one.');
    if (s.data().tries >= 5) throw new HttpsError('resource-exhausted', 'Too many tries. Send a new code.');
    const ok = crypto.createHash('sha256').update(clean(request.data?.code, 8)).digest('hex') === s.data().hash;
    if (!ok) { await ref.update({ tries: FieldValue.increment(1) }); throw new HttpsError('invalid-argument', "That code didn't match."); }
    const { phone } = s.data();
    const prev = await db.doc(`phones/${phone}`).get();
    if (prev.exists && prev.data().uid !== uid) await db.doc(`users/${prev.data().uid}`).set({ smsPhone: FieldValue.delete() }, { merge: true });
    await db.doc(`phones/${phone}`).set({ uid, at: FieldValue.serverTimestamp() });
    await db.doc(`users/${uid}`).set({ smsPhone: `•••${phone.slice(-4)}` }, { merge: true });
    await ref.delete();
    await sendSms(phone, 'Flyer is linked! Text this number any campus question, like "what\'s open for food right now?" Msg & data rates may apply. Reply STOP to opt out.');
    return { ok: true, masked: `•••${phone.slice(-4)}` };
  });
  exports.smsDisconnect = onCall(C.callOpts([TWILIO_AUTH_TOKEN]), async (request) => {
    const uid = C.requireAuth(request);
    const q = await db.collection('phones').where('uid', '==', uid).get();
    const b = db.batch(); q.docs.forEach((d) => b.delete(d.ref)); if (q.size) await b.commit();
    await db.doc(`users/${uid}`).set({ smsPhone: FieldValue.delete() }, { merge: true });
    await db.doc(`private/${uid}`).set({ smsContext: FieldValue.delete() }, { merge: true });
    return { ok: true };
  });
}

/* What Pilot may know when you text it: a short summary the app keeps
   up to date only while Text Flyer is on. Server-only. */
exports.saveSmsContext = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const text = clean(request.data?.context, 6000);
  await db.doc(`private/${uid}`).set({ smsContext: text, smsContextAt: Date.now() }, { merge: true });
  return { ok: true };
});
