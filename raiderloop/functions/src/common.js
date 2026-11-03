/**
 * Shared backend plumbing: auth checks, rate limits, budget breaker,
 * Claude + Tavily clients, Firestore cache, recency guard.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineInt } = require('firebase-functions/params');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const crypto = require('crypto');

if (!getApps().length) initializeApp();
const db = getFirestore();
const bucket = () => getStorage().bucket();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const TAVILY_API_KEY = defineSecret('TAVILY_API_KEY');
/* Hard ceiling on paid API calls (Claude + Tavily) per day across ALL
   users. If something goes viral or someone abuses an endpoint, the
   app degrades to "try again tomorrow" instead of running up a bill. */
const DAILY_PAID_CALL_CAP = defineInt('DAILY_PAID_CALL_CAP', { default: 2500 });
/* Set ENFORCE_APP_CHECK=true in functions/.env after setting up App
   Check (see SETUP.md). Read from the environment because function
   options are fixed at deploy time. */
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';

const MODEL = 'claude-sonnet-4-6';
const HOUR = 3600000;

const callOpts = (secrets = []) => ({
  secrets, cors: true, enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 20, timeoutSeconds: 60,
});

function requireAuth(request, { account = false } = {}) {
  const a = request.auth;
  if (!a) throw new HttpsError('unauthenticated', 'Please restart the app and try again.');
  if (account && a.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'This needs a Flyer account. Make one in You → Settings.');
  }
  return a.uid;
}

const today = () => new Date().toISOString().slice(0, 10);

/* Per-user daily counters. Throws a friendly resource-exhausted error
   when the limit is hit; the app shows the message as-is. */
async function takeQuota(uid, bucket, limit, message) {
  const ref = db.collection('usage').doc(`${uid}_${today()}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = (snap.exists && snap.data()[bucket]) || 0;
    if (used >= limit) throw new HttpsError('resource-exhausted', message || "You've hit today's limit for that. It resets at midnight.");
    tx.set(ref, { [bucket]: used + 1, uid, day: today() }, { merge: true });
  });
}

async function isPlus(uid) {
  const s = await db.collection('users').doc(uid).get();
  return !!(s.exists && s.data().plus);
}

/* Global budget breaker — counted per paid call. */
async function spend(n = 1) {
  const ref = db.collection('usage_global').doc(today());
  const snap = await ref.get();
  const used = (snap.exists && snap.data().calls) || 0;
  if (used >= DAILY_PAID_CALL_CAP.value()) {
    throw new HttpsError('resource-exhausted', 'Flyer is extra busy today, so live answers are paused until tomorrow. Everything else still works.');
  }
  await ref.set({ calls: FieldValue.increment(n) }, { merge: true });
}

async function callClaude({ system, messages, maxTokens, tools }) {
  await spend();
  const body = { model: MODEL, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.value(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.error('Claude error', resp.status, await resp.text());
    throw new HttpsError('internal', 'The assistant is unavailable right now.');
  }
  return resp.json();
}
async function claudeText(args) {
  const data = await callClaude(args);
  return (data.content || []).map((b) => b.text || '').join('');
}

async function tavilySearch({ query, includeImages = false, maxResults = 5, depth = 'advanced' }) {
  await spend();
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${TAVILY_API_KEY.value()}` },
    body: JSON.stringify({ api_key: TAVILY_API_KEY.value(), query, search_depth: depth, include_images: includeImages, max_results: maxResults }),
  });
  if (!resp.ok) {
    console.error('Tavily error', resp.status, await resp.text());
    throw new HttpsError('internal', 'Live search is unavailable right now.');
  }
  return resp.json();
}

async function tavilyExtract(urls) {
  await spend();
  const resp = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${TAVILY_API_KEY.value()}` },
    body: JSON.stringify({ urls }),
  });
  if (!resp.ok) return { results: [] };
  return resp.json();
}

async function getCached(key, maxAgeMs) {
  const doc = await db.collection('cache').doc(key).get();
  if (!doc.exists) return null;
  const d = doc.data();
  if (!d.cachedAt || Date.now() - d.cachedAt > maxAgeMs) return null;
  return d.value;
}
async function setCached(key, value) {
  await db.collection('cache').doc(key).set({ value, cachedAt: Date.now() });
}

/* "Empty" results are cached separately and for less time, so a quiet
   day doesn't trigger a paid search on every app open — but also
   doesn't lock out real results for the full TTL. */
async function cachedList(key, ttl, emptyTtl, compute) {
  const hit = await getCached(key, ttl);
  if (hit && hit.length) return { value: hit, cached: true };
  const empty = await getCached(`${key}__empty`, emptyTtl);
  if (empty) return { value: [], cached: true };
  const value = await compute();
  if (value && value.length) await setCached(key, value);
  else await setCached(`${key}__empty`, true);
  return { value: value || [], cached: false };
}

function parseJsonArray(text) {
  const cleaned = (text || '').replace(/```json|```/g, '').trim();
  try { const v = JSON.parse(cleaned); return Array.isArray(v) ? v : []; } catch (e) { /* fall through */ }
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { const v = JSON.parse(m[0]); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function parseJsonObject(text) {
  const cleaned = (text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

function recencyGuard() {
  const d = new Date().toISOString().slice(0, 10);
  return `
TODAY'S REAL DATE IS ${d}. You have no clock of your own — use that date, and only that date, to judge whether something is current.

RECENCY RULES (apply before including ANY entry):
1. If an entry's date is before ${d}, DROP IT.
2. If you cannot determine a specific date for an entry, DROP IT.
3. Watch the year. "October 18" with no year on a page from a previous year is NOT this year — drop it.
4. DROP anything written in past tense describing something already resolved ("was closed", "has been restored", "was cancelled").
5. When uncertain whether something is current, DROP IT. An empty result is correct; a stale result shown as current is a real failure.`;
}

const resultsText = (results) => (results.results || []).map((r) => `${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n---\n\n');

/* ================================================================
   Shared helpers for the social, play and tools features (2.x)
   ================================================================ */

/* Plain text in, plain text out: control characters stripped, trimmed,
   length-capped. Every user-typed string goes through this. */
const clean = (s, n = 200) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, n);
const cleanUrl = (u) => {
  const s = clean(u, 600);
  if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(s)) return '';
  return s;
};

/* Short, unguessable ids without look-alike characters (no 0/O/1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function shortId(n = 8) {
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/* The person running Flyer (you) is listed in config/app → admins. */
async function appConfig() {
  const s = await db.doc('config/app').get();
  return s.exists ? s.data() : {};
}
async function isAdmin(uid) {
  const cfg = await appConfig();
  return Array.isArray(cfg.admins) && cfg.admins.includes(uid);
}

/* A school season id, used to reset Flight Score each semester. */
function seasonId(d = new Date()) {
  const m = d.getMonth() + 1; const y = d.getFullYear();
  if (m >= 8) return `fall-${y}`;
  if (m <= 5) return `spring-${y}`;
  return `summer-${y}`;
}

/* Small public card for a user: what anyone at school can see. */
async function basicCard(uid) {
  const s = await db.collection('users').doc(uid).get();
  const d = s.exists ? s.data() : {};
  return { uid, name: d.name || '', handle: d.handle || '', avatar: d.avatar || {} };
}
const firstAndInitial = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A Flyer student';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};
async function friendIds(uid) {
  const s = await db.collection('users').doc(uid).collection('friends').get();
  return s.docs.map((d) => d.id);
}
async function areFriends(a, b) {
  return (await db.doc(`users/${a}/friends/${b}`).get()).exists;
}
async function isBlocked(a, b) {
  const [x, y] = await Promise.all([db.doc(`users/${a}/blocked/${b}`).get(), db.doc(`users/${b}/blocked/${a}`).get()]);
  return x.exists || y.exists;
}
async function blockedSet(uid) {
  const [mine, theirs] = await Promise.all([
    db.collection(`users/${uid}/blocked`).get(),
    db.collectionGroup('blocked').where('uid', '==', uid).limit(500).get().catch(() => ({ docs: [] })),
  ]);
  const set = new Set(mine.docs.map((d) => d.id));
  theirs.docs.forEach((d) => { const owner = d.ref.parent.parent; if (owner) set.add(owner.id); });
  return set;
}

/* ---------- Storage ----------
   Clients may only write into uploads/{uid}/… (see storage.rules).
   The server checks and moderates an upload, then copies it to its
   final home with a download token. The link is only ever stored in
   Firestore docs that the right people can read. */
async function readUpload(uid, uploadPath, { maxBytes = 8 * 1024 * 1024, types = ['image/jpeg', 'image/png', 'image/webp'] } = {}) {
  const p = clean(uploadPath, 300);
  if (!p.startsWith(`uploads/${uid}/`) || p.includes('..')) throw new HttpsError('invalid-argument', 'That upload is not yours.');
  const file = bucket().file(p);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('not-found', 'The photo did not finish uploading. Try again.');
  const [meta] = await file.getMetadata();
  if (Number(meta.size) > maxBytes) throw new HttpsError('invalid-argument', 'That file is too big.');
  if (types && !types.includes(meta.contentType)) throw new HttpsError('invalid-argument', 'That file type is not supported.');
  const [buf] = await file.download();
  return { file, buf, contentType: meta.contentType, path: p };
}
async function publishFile(srcFile, destPath, contentType) {
  const dest = bucket().file(destPath);
  await srcFile.copy(dest);
  const token = crypto.randomUUID();
  await dest.setMetadata({ contentType, cacheControl: 'private, max-age=86400', metadata: { firebaseStorageDownloadTokens: token } });
  await srcFile.delete().catch(() => {});
  return `https://firebasestorage.googleapis.com/v0/b/${bucket().name}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;
}
async function deleteFileByUrl(url) {
  const m = String(url || '').match(/\/o\/([^?]+)\?/);
  if (!m) return;
  await bucket().file(decodeURIComponent(m[1])).delete().catch(() => {});
}
async function deletePrefix(prefix) {
  await bucket().deleteFiles({ prefix }).catch(() => {});
}

/* ---------- Moderation ----------
   Every photo and every piece of text that other people will see is
   checked before it goes live (App Store Guideline 1.2). If the check
   itself can't run (budget breaker, outage) the item is held for your
   review instead of going live unchecked. */
const MOD_SYSTEM = `You review content for Flyer, a campus app used by college students (18+, but treat it as a school setting).
Decide if the content can be shown. Reject anything with:
- nudity, sexual content, or sexual solicitation
- graphic violence, gore, weapons shown threateningly
- hate, slurs, harassment, bullying, threats, or mocking a specific real person
- someone else's private info (phone numbers, home addresses, student IDs, license plates)
- selling or promoting illegal drugs; promoting underage drinking; pressure to binge drink
- self-harm or suicide promotion
- scams, spam, pyramid schemes, or links that look like phishing
Parties and social events are fine when described normally.
Return ONLY JSON: {"allowed": boolean, "category": "ok|sexual|violence|hate|harassment|privacy|drugs|selfharm|spam|other", "reason": "short, kind sentence for the poster", "hasPeople": boolean, "matches": boolean}
"hasPeople" is true if a real person's face or body is clearly visible in the image (false if there is no image).
"matches" answers the extra question if one is given, otherwise true.`;

async function moderate({ text = '', image = null, mediaType = 'image/jpeg', question = '' }) {
  const parts = [];
  if (image) parts.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: image.toString('base64') } });
  parts.push({ type: 'text', text: `Text: ${JSON.stringify(String(text).slice(0, 2000))}${question ? `\nExtra question: ${question}` : ''}` });
  try {
    const out = await claudeText({ system: MOD_SYSTEM, messages: [{ role: 'user', content: parts }], maxTokens: 200 });
    const j = parseJsonObject(out);
    if (!j || typeof j.allowed !== 'boolean') return { allowed: false, held: true, category: 'other', reason: 'Held for a quick review.' };
    return { allowed: j.allowed, held: false, category: j.category || 'ok', reason: j.reason || '', hasPeople: !!j.hasPeople, matches: j.matches !== false };
  } catch (e) {
    console.error('moderation unavailable', e.message);
    return { allowed: false, held: true, category: 'other', reason: 'Held for a quick review.' };
  }
}

/* ---------- Push (Expo push service; no extra keys needed) ---------- */
async function pushTo(uids, { title, body, data = {}, category = 'social' }) {
  const list = [...new Set((uids || []).filter(Boolean))];
  if (!list.length) return;
  const docs = await Promise.all(list.map((u) => db.doc(`pushTokens/${u}`).get()));
  const messages = [];
  docs.forEach((d) => {
    if (!d.exists) return;
    const v = d.data();
    if (category !== 'safety' && v.prefs && v.prefs[category] === false) return;
    (v.tokens || []).slice(-5).forEach((to) => messages.push({ to, title: String(title).slice(0, 120), body: String(body || '').slice(0, 240), data, sound: 'default', priority: category === 'safety' ? 'high' : 'default' }));
  });
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(messages.slice(i, i + 100)),
    }).catch((e) => console.error('push failed', e.message));
  }
}

/* ---------- Flight Score ----------
   Points are only ever given here, once per key (so the same hunt
   item or check-in can't be counted twice). */
async function award(uid, key, points, { stamp = null, label = '' } = {}) {
  const season = seasonId();
  const ref = db.doc(`scores/${uid}`);
  const led = ref.collection('ledger').doc(clean(key, 140).replace(/\//g, '_'));
  let given = false;
  await db.runTransaction(async (tx) => {
    const [l, s] = await Promise.all([tx.get(led), tx.get(ref)]);
    if (l.exists) return;
    const cur = s.exists ? s.data() : {};
    const fresh = cur.season !== season;
    const stamps = fresh ? [] : (cur.stamps || []);
    const nextStamps = stamp && !stamps.some((x) => x.id === stamp) ? [...stamps, { id: stamp, at: new Date().toISOString() }] : stamps;
    tx.set(led, { points, label, at: FieldValue.serverTimestamp(), season });
    tx.set(ref, { season, points: (fresh ? 0 : (cur.points || 0)) + points, stamps: nextStamps, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    given = true;
  });
  return given;
}

/* Friendship: both sides at once, requests cleared. */
async function makeFriends(a, b) {
  const [ca, cb] = await Promise.all([basicCard(a), basicCard(b)]);
  const strip = (c) => ({ name: c.name, handle: c.handle, avatar: c.avatar });
  const batch = db.batch();
  batch.set(db.doc(`users/${a}/friends/${b}`), { ...strip(cb), since: FieldValue.serverTimestamp() });
  batch.set(db.doc(`users/${b}/friends/${a}`), { ...strip(ca), since: FieldValue.serverTimestamp() });
  batch.delete(db.doc(`users/${a}/requests/${b}`));
  batch.delete(db.doc(`users/${b}/requests/${a}`));
  batch.delete(db.doc(`users/${a}/intros/${b}`));
  batch.delete(db.doc(`users/${b}/intros/${a}`));
  await batch.commit();
}

/* When two people stop being friends, each loses the other's posts
   and postcards right away. */
async function removeFanout(a, b) {
  const jobs = [];
  for (const [owner, other] of [[a, b], [b, a]]) {
    for (const sub of ['feed', 'postcards']) {
      jobs.push(db.collection(`users/${owner}/${sub}`).where('uid', '==', other).limit(400).get().then((q) => {
        if (!q.size) return null;
        const batch = db.batch(); q.docs.forEach((d) => batch.delete(d.ref)); return batch.commit();
      }).catch(() => {}));
    }
  }
  await Promise.all(jobs);
}

/* Where share links, QR codes and the TV page live. Defaults to your
   Firebase Hosting site; set SHARE_BASE in functions/.env if you
   connect a custom domain. */
function shareBase() {
  return (process.env.SHARE_BASE || `https://${process.env.GCLOUD_PROJECT || 'raiderloop-98046'}.web.app`).replace(/\/$/, '');
}

module.exports = {
  makeFriends, removeFanout, shareBase,
  db, FieldValue, HttpsError, ANTHROPIC_API_KEY, TAVILY_API_KEY, HOUR, callOpts, requireAuth, takeQuota, isPlus,
  callClaude, claudeText, tavilySearch, tavilyExtract, getCached, setCached, cachedList, parseJsonArray, parseJsonObject,
  recencyGuard, resultsText, today,
  clean, cleanUrl, shortId, appConfig, isAdmin, seasonId, basicCard, firstAndInitial, friendIds, areFriends, isBlocked, blockedSet,
  bucket, readUpload, publishFile, deleteFileByUrl, deletePrefix, moderate, pushTo, award, MODEL,
};
