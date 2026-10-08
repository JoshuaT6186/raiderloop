/**
 * Profiles, friends (handles + expiring QR codes), location sharing,
 * class rosters, school requests, sponsors, and the RevenueCat
 * webhook. Account deletion and data export live in account.js.
 *
 * All social writes go through these functions (Firestore rules deny
 * direct client writes), so every invariant lives in one place:
 *   • you can only share your location with current friends
 *   • removing/blocking a friend instantly removes their access
 *   • nobody is ever told they were removed, declined, or blocked
 */
const crypto = require('crypto');
const { onCall, onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const C = require('./common');
const S = require('./socialCore');

const { db, FieldValue, HttpsError, clean } = C;
const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');

const AVATAR_KEYS = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'facialHair', 'accessory', 'hat', 'shirt', 'shirtColor', 'bg', 'blush', 'number'];
function cleanAvatar(a) {
  const out = {};
  if (!a || typeof a !== 'object') return out;
  for (const k of AVATAR_KEYS) if (a[k] != null) out[k] = typeof a[k] === 'boolean' ? a[k] : clean(a[k], 24);
  return out;
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
  if (email && /.+@.+\..+/.test(email)) await db.collection('schoolRequests').doc(key).collection('emails').doc(uid).set({ email, uid, at: FieldValue.serverTimestamp() });
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
  throw new HttpsError('internal', "Couldn't make a username. Try again.");
}

exports.saveProfile = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const name = clean(request.data?.name, 40);
  const avatar = cleanAvatar(request.data?.avatar);
  const schoolId = clean(request.data?.schoolId, 20) || 'ttu';
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  let handle = snap.exists ? snap.data().handle : null;
  // Only write the username when it's brand new — setHandle owns
  // changes, and writing back a value read here could undo one.
  const fresh = !handle;
  if (fresh) handle = await assignHandle(uid, name);
  const verifiedEmail = S.verifiedSchoolEmail(request, schoolId);
  await ref.set({ name, avatar, schoolId, ...(fresh ? { handle } : {}), schoolVerified: !!verifiedEmail, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  // Refresh my card inside each friend's list and each chat I'm in.
  const friends = await ref.collection('friends').get();
  const batch = db.batch();
  friends.docs.forEach((f) => batch.set(db.doc(`users/${f.id}/friends/${uid}`), { name, avatar }, { merge: true }));
  const chats = await db.collection('chats').where('members', 'array-contains', uid).limit(100).get();
  chats.docs.forEach((c) => batch.set(c.ref, { memberCards: { [uid]: { name, avatar } } }, { merge: true }));
  await batch.commit();
  return { handle, schoolVerified: !!verifiedEmail };
});

/* ---------- Choose your own @username ----------
   Everyone gets one automatically (above); this lets them pick their
   own. Lowercase letters, numbers and underscores, 3-20 long. Lookup is
   exact-match only (sendFriendRequest) — there's no searchable list of
   students. */
const RESERVED = new Set(['flyer', 'flyerapp', 'admin', 'administrator', 'support', 'help', 'helpdesk', 'official', 'staff', 'mod', 'moderator',
  'team', 'security', 'root', 'system', 'pilot', 'ttu', 'texastech', 'texas_tech', 'raider', 'raiders', 'redraider', 'redraiders', 'raiderred',
  'masked_rider', 'maskedrider', 'sga', 'police', 'ttupd', 'president', 'eternityworks', 'apple', 'google', 'null', 'undefined', 'everyone', 'me', 'you']);

function checkHandle(raw) {
  const h = String(raw || '').trim().toLowerCase().replace(/^@/, '');
  if (h.length < 3 || h.length > 20) return { error: 'Usernames are 3 to 20 characters.' };
  if (!/^[a-z0-9_]+$/.test(h)) return { error: 'Use only letters, numbers and underscores.' };
  if (/^[0-9_]+$/.test(h)) return { error: 'Include at least one letter.' };
  if (/^_|_$|__/.test(h)) return { error: "Underscores can't be at the start, the end, or doubled." };
  if (RESERVED.has(h) || /^(flyer|admin|support|official|ttu|texastech)/.test(h)) return { error: 'That one is reserved. Try another.' };
  if (require('./chatCore').censorText(h.replace(/_/g, ' ')) !== h.replace(/_/g, ' ')) return { error: 'Pick a different username.' };
  return { handle: h };
}

const HANDLE_HOLD_MS = 30 * 24 * 3600000;

exports.setHandle = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const { handle, error } = checkHandle(request.data?.handle);
  if (error) throw new HttpsError('invalid-argument', error);
  const userRef = db.collection('users').doc(uid);
  const pre = await userRef.get();
  if (pre.exists && pre.data().handle === handle) return { handle };
  await C.takeQuota(uid, 'handleChange', 5, "You've changed your username a few times today. Try again tomorrow.");
  const newRef = db.collection('handles').doc(handle);
  // Read everything inside the transaction so two quick changes can't
  // both release the same old name and leave one of them orphaned.
  await db.runTransaction(async (tx) => {
    const [cur, taken] = await Promise.all([tx.get(userRef), tx.get(newRef)]);
    const old = cur.exists ? cur.data().handle : null;
    if (old === handle) return;
    if (taken.exists) {
      const t = taken.data();
      const heldForOther = t.heldUntil && t.heldUntil > Date.now();
      if (t.uid !== uid && (!t.heldUntil || heldForOther)) throw new HttpsError('already-exists', `@${handle} is taken. Try another.`);
    }
    tx.set(newRef, { uid });
    // The old name is held for 30 days so nobody can grab it and
    // receive requests meant for you. You can take it back meanwhile.
    if (old) tx.set(db.collection('handles').doc(old), { uid, heldUntil: Date.now() + HANDLE_HOLD_MS });
    tx.set(userRef, { handle, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  // Update my card in friends' lists and in requests I've sent.
  const [friends, sent] = await Promise.all([
    userRef.collection('friends').get(),
    db.collectionGroup('requests').where('fromUid', '==', uid).limit(200).get(),
  ]);
  const batch = db.batch();
  friends.docs.forEach((f) => batch.set(db.doc(`users/${f.id}/friends/${uid}`), { handle }, { merge: true }));
  sent.docs.forEach((r) => batch.set(r.ref, { handle }, { merge: true }));
  await batch.commit();
  return { handle };
});

/* ---------- Friends: requests by @handle ---------- */
exports.sendFriendRequest = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'friendReq', 40, "You've sent a lot of requests today. Try again tomorrow.");
  let target = clean(request.data?.uid, 64);
  if (!target) {
    const handle = clean(request.data?.handle, 30).toLowerCase().replace(/^@/, '');
    const h = handle ? await db.collection('handles').doc(handle).get() : null;
    if (!h || !h.exists || h.data().heldUntil) throw new HttpsError('not-found', `No one has the username @${handle}. Check the spelling.`);
    target = h.data().uid;
  }
  if (target === uid) throw new HttpsError('invalid-argument', "That's your own username!");
  if (await S.areFriends(uid, target)) throw new HttpsError('already-exists', "You're already friends.");
  // Blocked looks identical to "sent" — no signal either way.
  if (await S.isBlocked(uid, target)) return { ok: true };
  // If they already asked me, accept instead of making a second request.
  const theirs = await db.doc(`users/${uid}/requests/${target}`).get();
  if (theirs.exists) { await S.makeFriends(uid, target); return { ok: true, accepted: true }; }
  const me = await S.publicCard(uid);
  await db.doc(`users/${target}/requests/${uid}`).set({ ...me, fromUid: uid, at: FieldValue.serverTimestamp() });
  await C.sendPush([target], { title: 'New friend request', body: `${S.firstName(me.name) || 'Someone'} wants to be friends on Flyer.`, data: { open: 'friends', tab: 'requests' } });
  return { ok: true };
});

exports.respondFriendRequest = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const from = clean(request.data?.uid, 64);
  const req = await db.doc(`users/${uid}/requests/${from}`).get();
  if (!req.exists) return { ok: true };
  const senderExists = (await db.doc(`users/${from}`).get()).exists;
  if (request.data?.accept && senderExists && !(await S.isBlocked(uid, from))) await S.makeFriends(uid, from);
  else await req.ref.delete(); // silent decline (or the sender deleted their account)
  return { ok: true };
});

exports.removeFriend = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await S.unfriend(uid, clean(request.data?.uid, 64));
  return { ok: true };
});

exports.blockUser = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const other = clean(request.data?.uid, 64);
  if (!other || other === uid) throw new HttpsError('invalid-argument', 'Nobody to block.');
  await S.unfriend(uid, other);
  await Promise.all([
    db.doc(`users/${uid}/blocked/${other}`).set({ at: FieldValue.serverTimestamp() }),
    db.doc(`users/${uid}/requests/${other}`).delete().catch(() => {}),
    db.doc(`users/${other}/requests/${uid}`).delete().catch(() => {}),
  ]);
  // Nobody should be stuck in a flock with someone they blocked: if I
  // run the flock, they're removed from it. (Elsewhere their messages
  // are hidden from me and I can leave.)
  const flocks = await db.collection('chats').where('admins', 'array-contains', uid).get();
  await Promise.all(flocks.docs.filter((d) => d.data().type === 'flock' && (d.data().members || []).includes(other))
    .map((d) => d.ref.update({ members: FieldValue.arrayRemove(other), admins: FieldValue.arrayRemove(other) })));
  // Pending meetups between us are cancelled for both.
  const meets = await db.collection('meetups').where('members', 'array-contains', uid).get();
  await Promise.all(meets.docs.filter((d) => (d.data().members || []).includes(other) && (d.data().members || []).length === 2).map((d) => d.ref.delete()));
  return { ok: true };
});

/* ---------- Friends: expiring QR / invite codes ----------
   A code is a short random token that lasts 5 minutes (QR shown in
   person) or 24 hours (invite link you send). Scanning or opening one
   makes you friends right away — showing the code is the owner's
   consent, scanning it is yours. Because codes expire and can be
   reset, a screenshot posted online stops working. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newToken(n = 8) {
  const bytes = crypto.randomBytes(n);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

exports.createFriendCode = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'friendCode', 80, "That's a lot of new codes today. Try again tomorrow.");
  const kind = request.data?.kind === 'link' ? 'link' : 'qr';
  const ttl = kind === 'link' ? 24 * 3600000 : 5 * 60000;
  const token = newToken(8);
  const expiresAt = Date.now() + ttl;
  await db.doc(`friendCodes/${token}`).set({ uid, kind, expiresAt, createdAt: FieldValue.serverTimestamp() });
  return { code: token, expiresAt, ttlMs: ttl, url: `flyer://add/${token}` };
});

exports.redeemFriendCode = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'friendRedeem', 40, "That's a lot of codes today. Try again tomorrow.");
  const code = normCode(request.data?.code);
  const snap = code.length >= 6 ? await db.doc(`friendCodes/${code}`).get() : null;
  const bad = new HttpsError('not-found', "That code didn't work. Codes expire. Ask them to show a fresh one.");
  if (!snap || !snap.exists) throw bad;
  const d = snap.data();
  if (d.expiresAt < Date.now()) throw bad;
  if (d.uid === uid) throw new HttpsError('invalid-argument', "That's your own username!");
  if (await S.isBlocked(uid, d.uid)) throw bad;
  const card = await S.publicCard(d.uid);
  if (await S.areFriends(uid, d.uid)) return { ok: true, already: true, name: card.name };
  await S.makeFriends(uid, d.uid);
  const me = await S.publicCard(uid);
  await C.sendPush([d.uid], { title: 'New friend', body: `You and ${S.firstName(me.name) || 'someone'} are now friends on Flyer.`, data: { open: 'friends' } });
  return { ok: true, name: card.name };
});

exports.resetFriendCodes = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await S.deleteQuery(db.collection('friendCodes').where('uid', '==', uid));
  return { ok: true };
});

/* ---------- Location ---------- */
exports.updateLocation = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const wanted = Array.isArray(d.allowed) ? d.allowed.map((x) => clean(x, 64)).slice(0, 200) : [];
  // Only current friends can ever be on the list.
  const friendIds = await S.friendIds(uid);
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
  const me = await S.publicCard(uid);
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

/* Timed shares really end, and short-lived codes really disappear. */
exports.cleanupExpiredLocations = onSchedule('every 10 minutes', async () => {
  const now = new Date().toISOString();
  await S.deleteQuery(db.collection('locations').where('until', '<', now));
  // Also drop anything not refreshed in 2 hours (app closed long ago).
  await S.deleteQuery(db.collection('locations').where('updatedAt', '<', new Date(Date.now() - 2 * 3600000)));
  await S.deleteQuery(db.collection('friendCodes').where('expiresAt', '<', Date.now()));
});

/* ---------- Class rosters (opt-in, verified TTU email) ----------
   You appear only to other verified students who also opted in and
   have the same class (and section, when both of you entered one).
   Only a first name and avatar are shown. Enrollment itself is
   self-reported until Canvas sign-in is available, and the app says
   so. */
const normCourse = (c) => clean(c, 24).toUpperCase().replace(/^([A-Z]{2,5})\s*-?\s*(\d{4}).*$/, '$1 $2').replace(/\s+/g, ' ');
const normSection = (s) => clean(s, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');

function needVerified(request) {
  if (!S.verifiedSchoolEmail(request)) {
    throw new HttpsError('failed-precondition', 'Verify your TTU email first (You → Friends → Classmates). It keeps class lists to real students.');
  }
}

exports.setClassmateOptIn = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const ref = db.doc(`classmates/${uid}`);
  if (!request.data?.optIn) { await ref.delete().catch(() => {}); return { ok: true }; }
  needVerified(request);
  const raw = Array.isArray(request.data.classes) ? request.data.classes
    : (request.data.courses || []).map((c) => ({ course: c }));
  const classes = [];
  for (const c of raw.slice(0, 12)) {
    const course = normCourse(c && c.course);
    if (!/^[A-Z]{2,5} \d{4}$/.test(course)) continue;
    const section = normSection(c.section);
    if (!classes.some((x) => x.course === course)) classes.push({ course, section });
  }
  const user = await db.doc(`users/${uid}`).get();
  await ref.set({
    courses: classes.map((c) => c.course),
    sections: classes.filter((c) => c.section).map((c) => `${c.course}-${c.section}`),
    schoolId: (user.exists && user.data().schoolId) || 'ttu',
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, courses: classes.map((c) => c.course) };
});

exports.findClassmates = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  needVerified(request);
  await C.takeQuota(uid, 'classmates', 30);
  const mine = await db.doc(`classmates/${uid}`).get();
  if (!mine.exists) throw new HttpsError('failed-precondition', 'Turn on "Show me in class lists" first.');
  const { courses = [], sections = [], schoolId } = mine.data();
  const blockedSnap = await db.collection(`users/${uid}/blocked`).get();
  const blocked = new Set(blockedSnap.docs.map((d) => d.id));
  const friends = await S.friendIds(uid);
  const matches = [];
  for (const course of courses) {
    const sec = sections.find((s) => s.startsWith(`${course}-`));
    const q = sec
      ? db.collection('classmates').where('schoolId', '==', schoolId).where('sections', 'array-contains', sec)
      : db.collection('classmates').where('schoolId', '==', schoolId).where('courses', 'array-contains', course);
    const snap = await q.limit(60).get();
    const others = snap.docs.map((d) => d.id).filter((id) => id !== uid && !blocked.has(id));
    const people = [];
    for (const id of others.slice(0, 25)) {
      if (await S.isBlocked(uid, id)) continue;
      const [card, req] = await Promise.all([S.publicCard(id), db.doc(`users/${id}/requests/${uid}`).get()]);
      people.push({ uid: id, name: S.firstName(card.name), avatar: card.avatar, friend: friends.has(id), requested: req.exists });
    }
    matches.push({ course, section: sec ? sec.split('-')[1] : null, count: people.length, people });
  }
  return { matches };
});

/* ---------- Reports (people, messages, photos) ----------
   Reports land in the `reports` collection for you to review in the
   Firebase console. Apple expects you to act on them within 24 hours.
   A message reported by two different people is hidden for everyone
   right away. */
exports.reportContent = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'report', 30);
  const d = request.data || {};
  const report = {
    by: uid, reason: clean(d.reason, 300) || 'No reason given', target: clean(d.uid, 64) || null,
    chatId: clean(d.chatId, 80) || null, messageId: clean(d.messageId, 80) || null, kind: clean(d.kind, 20) || 'user',
    at: FieldValue.serverTimestamp(), status: 'open',
  };
  if (report.chatId && report.messageId) {
    const chat = await db.doc(`chats/${report.chatId}`).get();
    if (!chat.exists || !(chat.data().members || []).includes(uid)) throw new HttpsError('permission-denied', 'You can only report messages in your own chats.');
    const mref = db.doc(`chats/${report.chatId}/messages/${report.messageId}`);
    const msg = await mref.get();
    if (msg.exists) {
      const m = msg.data();
      report.target = m.from; report.text = m.text || null; report.image = m.image ? m.image.path : null;
      const by = new Set([...(m.reportedBy || []), uid]);
      await mref.update({ reportedBy: [...by], hidden: by.size >= 2 });
    }
  }
  await db.collection('reports').add(report);
  return { ok: true };
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
