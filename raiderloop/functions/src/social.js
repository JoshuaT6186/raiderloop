/**
 * Profiles, friends, location sharing, classmates, school requests,
 * sponsors, account deletion, and the RevenueCat webhook.
 *
 * All social writes go through these functions (Firestore rules deny
 * direct client writes), so every invariant lives in one place:
 *   • you can only share your location with current friends
 *   • removing/blocking a friend instantly removes their read access
 *   • nobody is ever told they were removed, declined, or blocked
 */
const { onCall, onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const C = require('./common');

const { db, FieldValue, HttpsError } = C;
const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');

const clean = (s, n = 60) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const AVATAR_KEYS = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'facialHair', 'accessory', 'hat', 'shirt', 'shirtColor', 'bg', 'blush', 'number'];
function cleanAvatar(a) {
  const out = {};
  if (!a || typeof a !== 'object') return out;
  for (const k of AVATAR_KEYS) if (a[k] != null) out[k] = typeof a[k] === 'boolean' ? a[k] : clean(a[k], 24);
  return out;
}

async function publicCard(uid) {
  const s = await db.collection('users').doc(uid).get();
  const d = s.exists ? s.data() : {};
  return { name: d.name || '', handle: d.handle || '', avatar: d.avatar || {} };
}
async function isBlocked(a, b) {
  const [x, y] = await Promise.all([
    db.doc(`users/${a}/blocked/${b}`).get(), db.doc(`users/${b}/blocked/${a}`).get(),
  ]);
  return x.exists || y.exists;
}
async function areFriends(a, b) {
  return (await db.doc(`users/${a}/friends/${b}`).get()).exists;
}

/* ---------- School requests ---------- */
exports.requestSchool = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const school = clean(request.data?.school, 100);
  const email = clean(request.data?.email, 120);
  if (school.length < 3) throw new HttpsError('invalid-argument', 'Type the school name.');
  await C.takeQuota(uid, 'schoolReq', 5);
  const key = school.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
  await db.collection('schoolRequests').doc(key).set({ name: school, count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (email && /.+@.+\..+/.test(email)) await db.collection('schoolRequests').doc(key).collection('emails').doc(uid).set({ email, at: FieldValue.serverTimestamp() });
  return { ok: true };
});

/* ---------- Profile ---------- */
async function assignHandle(uid, name) {
  const base = (clean(name, 20).toLowerCase().replace(/[^a-z0-9]/g, '') || 'flyer').slice(0, 12);
  for (let i = 0; i < 12; i++) {
    const handle = `${base}${Math.floor(10 + Math.random() * (i < 6 ? 90 : 9990))}`;
    const ref = db.collection('handles').doc(handle);
    try {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (s.exists) throw new Error('taken');
        tx.set(ref, { uid });
      });
      return handle;
    } catch (e) { /* try another */ }
  }
  throw new HttpsError('internal', "Couldn't make a friend code — try again.");
}

exports.saveProfile = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const name = clean(request.data?.name, 40);
  const avatar = cleanAvatar(request.data?.avatar);
  const schoolId = clean(request.data?.schoolId, 20) || 'ttu';
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  let handle = snap.exists ? snap.data().handle : null;
  if (!handle) handle = await assignHandle(uid, name);
  await ref.set({ name, avatar, schoolId, handle, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  // Refresh my card inside each friend's list so they see my new avatar/name.
  const friends = await ref.collection('friends').get();
  const batch = db.batch();
  friends.docs.forEach((f) => batch.set(db.doc(`users/${f.id}/friends/${uid}`), { name, avatar, handle }, { merge: true }));
  await batch.commit();
  return { handle };
});

/* ---------- Friends ---------- */
exports.sendFriendRequest = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'friendReq', 40, "You've sent a lot of requests today — try again tomorrow.");
  let target = clean(request.data?.uid, 64);
  if (!target) {
    const handle = clean(request.data?.handle, 30).toLowerCase().replace(/^@/, '');
    const h = handle ? await db.collection('handles').doc(handle).get() : null;
    if (!h || !h.exists) throw new HttpsError('not-found', `No one has the code @${handle}. Check the spelling.`);
    target = h.data().uid;
  }
  if (target === uid) throw new HttpsError('invalid-argument', "That's your own code!");
  if (await areFriends(uid, target)) throw new HttpsError('already-exists', "You're already friends.");
  // Blocked looks identical to "sent" — no signal either way.
  if (await isBlocked(uid, target)) return { ok: true };
  // If they already asked me, accept instead of making a second request.
  const theirs = await db.doc(`users/${uid}/requests/${target}`).get();
  if (theirs.exists) { await makeFriends(uid, target); return { ok: true, accepted: true }; }
  const me = await publicCard(uid);
  await db.doc(`users/${target}/requests/${uid}`).set({ ...me, at: FieldValue.serverTimestamp() });
  return { ok: true };
});

async function makeFriends(a, b) {
  const [ca, cb] = await Promise.all([publicCard(a), publicCard(b)]);
  const batch = db.batch();
  batch.set(db.doc(`users/${a}/friends/${b}`), { ...cb, since: FieldValue.serverTimestamp() });
  batch.set(db.doc(`users/${b}/friends/${a}`), { ...ca, since: FieldValue.serverTimestamp() });
  batch.delete(db.doc(`users/${a}/requests/${b}`));
  batch.delete(db.doc(`users/${b}/requests/${a}`));
  await batch.commit();
}

exports.respondFriendRequest = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const from = clean(request.data?.uid, 64);
  const req = await db.doc(`users/${uid}/requests/${from}`).get();
  if (!req.exists) return { ok: true };
  if (request.data?.accept && !(await isBlocked(uid, from))) await makeFriends(uid, from);
  else await req.ref.delete(); // silent decline
  return { ok: true };
});

async function unfriend(a, b) {
  const batch = db.batch();
  batch.delete(db.doc(`users/${a}/friends/${b}`));
  batch.delete(db.doc(`users/${b}/friends/${a}`));
  await batch.commit();
  // Quiet revocation, both directions, effective immediately.
  await Promise.all([
    db.doc(`locations/${a}`).update({ allowed: FieldValue.arrayRemove(b) }).catch(() => {}),
    db.doc(`locations/${b}`).update({ allowed: FieldValue.arrayRemove(a) }).catch(() => {}),
  ]);
}

exports.removeFriend = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await unfriend(uid, clean(request.data?.uid, 64));
  return { ok: true };
});

exports.blockUser = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const other = clean(request.data?.uid, 64);
  if (!other || other === uid) throw new HttpsError('invalid-argument', 'Nobody to block.');
  await unfriend(uid, other);
  await Promise.all([
    db.doc(`users/${uid}/blocked/${other}`).set({ at: FieldValue.serverTimestamp() }),
    db.doc(`users/${uid}/requests/${other}`).delete().catch(() => {}),
    db.doc(`users/${other}/requests/${uid}`).delete().catch(() => {}),
  ]);
  return { ok: true };
});

/* ---------- Location ---------- */
exports.updateLocation = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const wanted = Array.isArray(d.allowed) ? d.allowed.map((x) => clean(x, 64)).slice(0, 200) : [];
  // Only current friends can ever be on the list.
  const friendSnap = await db.collection('users').doc(uid).collection('friends').get();
  const friendIds = new Set(friendSnap.docs.map((x) => x.id));
  const allowed = wanted.filter((x) => friendIds.has(x));
  const until = d.until && !Number.isNaN(Date.parse(d.until)) ? new Date(d.until).toISOString() : null;
  const ref = db.doc(`locations/${uid}`);
  if (!allowed.length) { await ref.delete().catch(() => {}); return { ok: true }; }
  if (d.allowedOnly) {
    const s = await ref.get();
    if (s.exists) await ref.set({ allowed, until }, { merge: true });
    return { ok: true };
  }
  const lat = Number(d.lat); const lng = Number(d.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpsError('invalid-argument', 'Bad location.');
  const me = await publicCard(uid);
  await ref.set({
    lat, lng, precise: !!d.precise, allowed, until, name: me.name, avatar: me.avatar, updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

exports.stopSharing = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  await db.doc(`locations/${uid}`).delete().catch(() => {});
  return { ok: true };
});

/* Timed shares really end: expired location docs are deleted. */
exports.cleanupExpiredLocations = onSchedule('every 10 minutes', async () => {
  const now = new Date().toISOString();
  const q = await db.collection('locations').where('until', '<', now).limit(400).get();
  const batch = db.batch();
  q.docs.forEach((d) => batch.delete(d.ref));
  if (q.size) await batch.commit();
  // Also drop anything not refreshed in 2 hours (app closed long ago).
  const stale = await db.collection('locations').where('updatedAt', '<', new Date(Date.now() - 2 * 3600000)).limit(400).get();
  const b2 = db.batch();
  stale.docs.forEach((d) => b2.delete(d.ref));
  if (stale.size) await b2.commit();
});

/* ---------- Classmates (opt-in) ---------- */
const normCourse = (c) => clean(c, 16).toUpperCase().replace(/\s+/g, ' ');

exports.setClassmateOptIn = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const ref = db.doc(`classmates/${uid}`);
  if (!request.data?.optIn) { await ref.delete().catch(() => {}); return { ok: true }; }
  const courses = [...new Set((request.data.courses || []).map(normCourse).filter((c) => /^[A-Z]{2,5} \d{4}$/.test(c)))].slice(0, 10);
  const user = await db.doc(`users/${uid}`).get();
  await ref.set({ courses, schoolId: (user.exists && user.data().schoolId) || 'ttu', updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, courses };
});

exports.findClassmates = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'classmates', 20);
  const mine = await db.doc(`classmates/${uid}`).get();
  if (!mine.exists) throw new HttpsError('failed-precondition', 'Turn on "Find classmates" first.');
  const { courses, schoolId } = mine.data();
  const blockedSnap = await db.collection(`users/${uid}/blocked`).get();
  const blocked = new Set(blockedSnap.docs.map((d) => d.id));
  const matches = [];
  for (const course of courses) {
    const q = await db.collection('classmates').where('schoolId', '==', schoolId).where('courses', 'array-contains', course).limit(40).get();
    const others = q.docs.map((d) => d.id).filter((id) => id !== uid && !blocked.has(id));
    const people = [];
    for (const id of others.slice(0, 8)) {
      if (await isBlocked(uid, id)) continue;
      const card = await publicCard(id);
      people.push({ uid: id, name: card.name, avatar: card.avatar });
    }
    matches.push({ course, count: others.length, people });
  }
  return { matches: matches.filter((m) => m.count > 0) };
});

/* ---------- Sponsors (local businesses; added by you in Firestore) ---------- */
exports.getSponsors = onCall(C.callOpts(), async (request) => {
  C.requireAuth(request);
  const schoolId = 'ttu';
  const now = new Date().toISOString();
  const q = await db.collection('sponsors').where('schoolId', '==', schoolId).where('active', '==', true).limit(10).get();
  const sponsors = q.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => (!s.startsAt || s.startsAt <= now) && (!s.endsAt || s.endsAt >= now))
    .map((s) => ({ id: s.id, name: s.name, offer: s.offer, url: s.url, color: s.color || 'green', distance: s.distance || null }));
  return { sponsors };
});

/* ---------- Delete account ---------- */
async function deleteCollection(path) {
  const snap = await db.collection(path).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.docs;
}

exports.deleteAccount = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const friends = await deleteCollection(`users/${uid}/friends`);
  await Promise.all(friends.map((f) => unfriend(uid, f.id)));
  await deleteCollection(`users/${uid}/requests`);
  await deleteCollection(`users/${uid}/blocked`);
  const user = await db.doc(`users/${uid}`).get();
  if (user.exists && user.data().handle) await db.doc(`handles/${user.data().handle}`).delete().catch(() => {});
  await Promise.all([
    db.doc(`users/${uid}`).delete(), db.doc(`locations/${uid}`).delete(), db.doc(`classmates/${uid}`).delete(),
    db.doc(`private/${uid}`).delete(),
  ].map((p) => p.catch(() => {})));
  return { ok: true };
});

/* ---------- RevenueCat → Flyer Plus ----------
   In RevenueCat: Integrations → Webhooks → URL of this function,
   Authorization header = the REVENUECAT_WEBHOOK_AUTH secret. */
const ACTIVE = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'];
const INACTIVE = ['EXPIRATION'];
exports.revenuecatWebhook = onRequest({ secrets: [REVENUECAT_WEBHOOK_AUTH] }, async (req, res) => {
  if (req.get('Authorization') !== REVENUECAT_WEBHOOK_AUTH.value()) { res.status(401).send('no'); return; }
  const ev = req.body && req.body.event;
  if (!ev || !ev.app_user_id || ev.app_user_id.startsWith('$RCAnonymousID')) { res.status(200).send('ignored'); return; }
  let plus = null;
  if (ACTIVE.includes(ev.type)) plus = true;
  if (INACTIVE.includes(ev.type)) plus = false;
  if (plus !== null) {
    await db.doc(`users/${ev.app_user_id}`).set({ plus, plusUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await getAuth().setCustomUserClaims(ev.app_user_id, { plus }).catch(() => {});
  }
  res.status(200).send('ok');
});
