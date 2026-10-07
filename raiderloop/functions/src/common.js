/**
 * Shared backend plumbing: auth checks, rate limits, budget breaker,
 * Claude + Tavily clients, Firestore cache, recency guard.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineInt } = require('firebase-functions/params');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

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

/* Days roll over at midnight in Lubbock, not UTC, so "resets at
   midnight" in the app's messages is true. */
const TZ = 'America/Chicago';
const chicagoDay = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const chicagoHour = (ms = Date.now()) => Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms))) % 24;
const today = () => chicagoDay();
/* Monday of the current week, as YYYY-MM-DD (Lubbock time). */
function weekKey(ms = Date.now()) {
  const d = new Date(`${chicagoDay(ms)}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
/* "2026-10-17T14:30:00" written in Lubbock local time → epoch ms.
   Tries CDT then CST and keeps the one that round-trips. */
function chicagoMs(localIso) {
  const wantHour = Number(String(localIso).slice(11, 13));
  for (const off of ['-05:00', '-06:00']) {
    const ms = new Date(`${localIso}${off}`).getTime();
    if (chicagoHour(ms) === wantHour) return ms;
  }
  return new Date(`${localIso}-06:00`).getTime();
}
/* "-05:00" during daylight time, "-06:00" otherwise (Lubbock). */
function chicagoOffset(ms = Date.now()) {
  const local = new Date(new Date(ms).toLocaleString('en-US', { timeZone: TZ }));
  const utc = new Date(new Date(ms).toLocaleString('en-US', { timeZone: 'UTC' }));
  const h = Math.round((utc - local) / 3600000);
  return `-${String(h).padStart(2, '0')}:00`;
}
function distanceM(a, b) {
  if (!a || !b) return null;
  const R = 6371000; const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const clean = (s, n = 60) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

/* Push notifications through Expo's push service (no key needed;
   Apple delivery uses the push key stored in your EAS credentials).
   Tokens live in pushTokens/{uid}. Muted chats are skipped. Dead
   tokens are pruned. Never throws — a failed push must not fail the
   action that caused it. */
async function sendPush(uids, { title, body, data = {}, chatId = null }) {
  try {
    const ids = [...new Set((uids || []).filter(Boolean))];
    if (!ids.length) return;
    const snaps = await Promise.all(ids.map((u) => db.doc(`pushTokens/${u}`).get()));
    const messages = [];
    const owners = [];
    snaps.forEach((s, i) => {
      if (!s.exists) return;
      const d = s.data();
      if (chatId && d.muted && d.muted[chatId]) return;
      (d.tokens || []).slice(-5).forEach((to) => { messages.push({ to, title, body: String(body || '').slice(0, 180), data, sound: 'default' }); owners.push([ids[i], to]); });
    });
    if (!messages.length) return;
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(messages),
    });
    const json = await resp.json().catch(() => null);
    const tickets = (json && json.data) || [];
    await Promise.all(tickets.map((tk, i) => (tk && tk.details && tk.details.error === 'DeviceNotRegistered'
      ? db.doc(`pushTokens/${owners[i][0]}`).update({ tokens: FieldValue.arrayRemove(owners[i][1]) }).catch(() => {})
      : null)));
  } catch (e) { console.error('push failed', e.message); }
}

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

const FAST_MODEL = 'claude-haiku-4-5-20251001';
async function callClaude({ system, messages, maxTokens, tools, model }) {
  await spend();
  const body = { model: model || MODEL, max_tokens: maxTokens, system, messages };
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

module.exports = {
  db, FieldValue, HttpsError, ANTHROPIC_API_KEY, TAVILY_API_KEY, HOUR, FAST_MODEL, callOpts, requireAuth, takeQuota, isPlus,
  callClaude, claudeText, tavilySearch, tavilyExtract, getCached, setCached, cachedList, parseJsonArray, parseJsonObject,
  recencyGuard, resultsText, today, chicagoOffset, chicagoDay, chicagoHour, chicagoMs, weekKey, distanceM, clean, sendPush,
};
