/**
 * Schedule sharing and nearby-friend alerts.
 * ------------------------------------------------------------
 * Schedule sharing is off by default and set friend by friend:
 *   off  → they see nothing
 *   busy → they see when you're busy (no class names or buildings)
 *   full → they see your classes, times, and buildings
 * Two documents with separate reader lists keep "busy" readers from
 * ever receiving the full version.
 *
 * Nearby alerts are opt-in on BOTH sides: you only get "Maya is
 * nearby" if you picked Maya and Maya picked you. Nobody ever sees
 * where the other person is — only that they're close (~250 m), on
 * campus, outside quiet hours (11 pm–7 am), at most once every 3
 * hours per pair.
 */
const { onCall } = require('firebase-functions/v2/https');
const C = require('./common');
const S = require('./socialCore');
const SCHOOL_CENTER = { lat: 33.58434, lng: -101.87656 }; // Texas Tech, same as src/config.js

const { db, FieldValue, HttpsError, clean } = C;
const DAYS = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

function cleanBusy(list) {
  return (Array.isArray(list) ? list : []).slice(0, 60).map((b) => ({
    d: DAYS.includes(b.d) ? b.d : null, s: Math.round(Number(b.s)), e: Math.round(Number(b.e)),
  })).filter((b) => b.d && b.s >= 0 && b.e <= 1440 && b.e > b.s);
}
function cleanFull(list) {
  return (Array.isArray(list) ? list : []).slice(0, 30).map((c) => ({
    title: clean(c.title, 40), days: (Array.isArray(c.days) ? c.days : []).filter((d) => DAYS.includes(d)),
    time: clean(c.time, 10), endTime: clean(c.endTime, 10), place: clean(c.place, 80), buildingId: clean(c.buildingId, 80) || null,
  })).filter((c) => c.title && c.days.length);
}

exports.updateScheduleShare = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'schedShare', 200);
  const d = request.data || {};
  const friends = await S.friendIds(uid);
  const levels = {};
  for (const [k, v] of Object.entries(d.levels || {})) if (friends.has(k) && (v === 'busy' || v === 'full')) levels[k] = v;
  const readers = Object.keys(levels);
  const fullReaders = readers.filter((k) => levels[k] === 'full');
  const a = db.doc(`schedules/${uid}`); const b = db.doc(`schedulesFull/${uid}`);
  if (!readers.length) { await Promise.all([a.delete(), b.delete()].map((p) => p.catch(() => {}))); return { ok: true, readers: 0 }; }
  await a.set({ busy: cleanBusy(d.busy), readers, updatedAt: FieldValue.serverTimestamp() });
  if (fullReaders.length) await b.set({ classes: cleanFull(d.full), readers: fullReaders, updatedAt: FieldValue.serverTimestamp() });
  else await b.delete().catch(() => {});
  return { ok: true, readers: readers.length };
});

/* ---------- Nearby alerts ---------- */
exports.setNearbyPrefs = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const friends = await S.friendIds(uid);
  const allow = (Array.isArray(d.allow) ? d.allow : []).map((x) => clean(x, 64)).filter((x) => friends.has(x)).slice(0, 100);
  if (!d.on || !allow.length) { await db.doc(`nearby/${uid}`).delete().catch(() => {}); return { ok: true, on: false }; }
  await db.doc(`nearby/${uid}`).set({ on: true, allow, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, on: true };
});

exports.nearbyPing = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'nearby', 300);
  const lat = Number(request.data?.lat); const lng = Number(request.data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpsError('invalid-argument', 'Bad location.');
  const ref = db.doc(`nearby/${uid}`);
  const mine = await ref.get();
  if (!mine.exists || !mine.data().on) return { ok: true, off: true };
  const now = Date.now();
  const pos = { lat: Math.round(lat * 1e3) / 1e3, lng: Math.round(lng * 1e3) / 1e3 };
  const onCampus = C.distanceM(pos, SCHOOL_CENTER) <= 2500;
  // Off campus: forget my last position entirely.
  if (!onCampus) { await ref.update({ pos: FieldValue.delete(), at: 0 }); return { ok: true, offCampus: true }; }
  await ref.update({ pos, at: now });
  const hour = C.chicagoHour(now);
  if (hour >= 23 || hour < 7) return { ok: true, quiet: true };
  const allow = mine.data().allow || [];
  const hits = [];
  for (const f of allow) {
    const o = await db.doc(`nearby/${f}`).get();
    if (!o.exists) continue;
    const od = o.data();
    if (!od.on || !(od.allow || []).includes(uid) || !od.pos || now - (od.at || 0) > 20 * 60000) continue;
    if (C.distanceM(pos, od.pos) > 250) continue;
    const pair = [uid, f].sort().join('_');
    const pref = db.doc(`nearbyPairs/${pair}`);
    const fresh = await db.runTransaction(async (tx) => {
      const p = await tx.get(pref);
      if (p.exists && now - p.data().lastAt < 3 * 3600000) return false;
      tx.set(pref, { lastAt: now });
      return true;
    });
    if (fresh) hits.push(f);
  }
  if (hits.length) {
    const me = S.firstName((await S.publicCard(uid)).name) || 'A friend';
    for (const f of hits) {
      const them = S.firstName((await S.publicCard(f)).name) || 'A friend';
      await C.sendPush([f], { title: `${me} is nearby`, body: 'Say hi, or send a meetup card.', data: { open: 'friend', uid } });
      await C.sendPush([uid], { title: `${them} is nearby`, body: 'Say hi, or send a meetup card.', data: { open: 'friend', uid: f } });
    }
  }
  return { ok: true, nearby: hits.length };
});
