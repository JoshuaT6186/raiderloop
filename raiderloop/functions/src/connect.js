/**
 * Connect: push tokens, the Connect card, Say hi intros, teammate
 * photo swaps, Flyer Drop, share links, reports, the admin queue,
 * org claims, and "What Flyer knows about you".
 *
 * Visibility tiers (matches the "Who sees what" screen):
 *   everyone at school : avatar, name, plus card fields set to "Everyone"
 *   friends            : + fields set to "Friends", face photo, Story
 *   teammates          : + face photo, only while a photo swap is active
 * Blocked people see nothing and are never told.
 */
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const C = require('./common');

const { db, FieldValue, HttpsError, clean } = C;
const AI = [C.ANTHROPIC_API_KEY];

/* ---------------- Client error log (App Review debugging) ---------------- */
exports.logClientError = onCall(C.callOpts(), async (request) => {
  const uid = request.auth ? request.auth.uid : 'signed-out';
  const d = request.data || {};
  if (request.auth) await C.takeQuota(uid, 'errlog', 30).catch(() => { throw new HttpsError('resource-exhausted', 'ok'); });
  await db.collection('clientErrors').add({
    uid, where: clean(d.where, 60), code: clean(d.code, 80), message: clean(d.message, 500),
    platform: clean(d.platform, 20), os: clean(d.os, 30), app: clean(d.app, 30), at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/* ---------------- Push tokens + preferences ---------------- */
const PUSH_PREFS = ['social', 'drops', 'groups', 'plans', 'queue', 'play'];
exports.savePushToken = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const d = request.data || {};
  const token = clean(d.token, 200);
  if (token && !/^Expo(nent)?PushToken\[.+\]$/.test(token)) throw new HttpsError('invalid-argument', 'Bad push token.');
  const ref = db.doc(`pushTokens/${uid}`);
  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (token) patch.tokens = d.remove ? FieldValue.arrayRemove(token) : FieldValue.arrayUnion(token);
  if (d.prefs && typeof d.prefs === 'object') {
    patch.prefs = {};
    PUSH_PREFS.forEach((k) => { if (typeof d.prefs[k] === 'boolean') patch.prefs[k] = d.prefs[k]; });
  }
  await ref.set(patch, { merge: true });
  return { ok: true };
});

/* ---------------- Connect card ---------------- */
const { visibleCard, cleanCard } = require('./lib/card');

async function writePublicCard(uid, card) {
  const base = await C.basicCard(uid);
  if (!base.handle) return;
  await db.doc(`publicCards/${base.handle}`).set({ uid, name: base.name, handle: base.handle, avatar: base.avatar, ...visibleCard(card, 0), updatedAt: FieldValue.serverTimestamp() });
}

exports.saveCard = onCall(C.callOpts(AI), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'card', 40, "You've updated your card a lot today. Try again tomorrow.");
  const card = cleanCard(request.data || {});
  const text = [card.headline, ...card.orgs.map((o) => o.name), ...card.links.map((l) => l.url)].filter(Boolean).join('\n');
  if (text) {
    const m = await C.moderate({ text });
    if (!m.allowed && !m.held) throw new HttpsError('invalid-argument', m.reason || "Part of your card can't be shown. Try different wording.");
  }
  const ref = db.doc(`cards/${uid}`);
  await ref.set({ ...card, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await writePublicCard(uid, card);
  return { ok: true };
});

async function relationTo(viewer, owner) {
  if (viewer === owner) return 'self';
  if (await C.isBlocked(viewer, owner)) return 'blocked';
  if (await C.areFriends(viewer, owner)) return 'friend';
  return 'school';
}
async function faceShareActive(a, b) {
  const key = [a, b].sort().join('_');
  const s = await db.doc(`faceShares/${key}`).get();
  if (!s.exists) return false;
  const f = s.data();
  return f.okA && f.okB && (!f.until || new Date(f.until) > new Date());
}

exports.getCard = onCall(C.callOpts(), async (request) => {
  const viewer = C.requireAuth(request);
  let owner = clean(request.data?.uid, 64);
  if (!owner) {
    const handle = clean(request.data?.handle, 30).toLowerCase().replace(/^@/, '');
    const h = handle ? await db.doc(`handles/${handle}`).get() : null;
    if (!h || !h.exists) throw new HttpsError('not-found', 'No card found for that code.');
    owner = h.data().uid;
  }
  const rel = await relationTo(viewer, owner);
  if (rel === 'blocked') throw new HttpsError('not-found', 'No card found for that code.');
  const [base, cardSnap, reqSnap] = await Promise.all([
    C.basicCard(owner), db.doc(`cards/${owner}`).get(), db.doc(`users/${owner}/requests/${viewer}`).get(),
  ]);
  const card = cardSnap.exists ? cardSnap.data() : null;
  const level = rel === 'school' ? 0 : 1;
  const out = { uid: owner, name: rel === 'school' ? C.firstAndInitial(base.name) : base.name, handle: base.handle, avatar: base.avatar, relation: rel, requestSent: reqSnap.exists, card: rel === 'self' ? (card || {}) : visibleCard(card, level) };
  const faceAllowed = card && card.faceUrl && card.show?.face !== 'off' && (rel === 'self' || rel === 'friend' || (await faceShareActive(viewer, owner)));
  if (faceAllowed) out.faceUrl = card.faceUrl;
  return out;
});

exports.setFacePhoto = onCall({ ...C.callOpts(AI), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const ref = db.doc(`cards/${uid}`);
  if (request.data?.remove) {
    const s = await ref.get();
    if (s.exists && s.data().faceUrl) await C.deleteFileByUrl(s.data().faceUrl);
    await ref.set({ faceUrl: FieldValue.delete() }, { merge: true });
    return { ok: true };
  }
  await C.takeQuota(uid, 'face', 10, 'Try again tomorrow.');
  const up = await C.readUpload(uid, request.data?.uploadPath);
  const m = await C.moderate({ image: up.buf, mediaType: up.contentType, question: 'Is this a normal profile-style photo of a person (a face is fine)?' });
  if (!m.allowed) { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', m.held ? "We couldn't check that photo right now. Try again in a bit." : (m.reason || "That photo can't be used.")); }
  const old = await ref.get();
  const url = await C.publishFile(up.file, `faces/${uid}/${C.shortId(10)}.jpg`, up.contentType);
  if (old.exists && old.data().faceUrl) await C.deleteFileByUrl(old.data().faceUrl);
  await ref.set({ faceUrl: url, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, faceUrl: url };
});

/* Apple Wallet: a one-time link the phone opens in Safari. The pass
   itself is built in web.js when WALLET_ENABLED=true. */
exports.walletLink = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  if (process.env.WALLET_ENABLED !== 'true') throw new HttpsError('failed-precondition', "Apple Wallet isn't set up for Flyer yet. Your QR code works the same way.");
  const token = C.shortId(16);
  await db.doc(`walletTokens/${token}`).set({ uid, exp: Date.now() + 10 * 60000 });
  return { url: `${C.shareBase()}/wallet/${token}` };
});

/* ---------------- Say hi ---------------- */
const normCourse = (c) => clean(c, 16).toUpperCase().replace(/\s+/g, ' ');
const normOrg = (o) => clean(o, 80).toLowerCase();

exports.setSayHi = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const ref = db.doc(`sayHi/${uid}`);
  if (!d.visible) { await ref.delete().catch(() => {}); return { ok: true, visible: false }; }
  const courses = [...new Set((d.courses || []).map(normCourse).filter((c) => /^[A-Z]{2,5} \d{4}$/.test(c)))].slice(0, 10);
  const orgs = [...new Set((d.orgs || []).map(normOrg).filter(Boolean))].slice(0, 10);
  const user = await db.doc(`users/${uid}`).get();
  await ref.set({ visible: true, courses, orgs, schoolId: (user.exists && user.data().schoolId) || 'ttu', updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, visible: true, courses, orgs };
});

async function sharedWith(me, other) {
  const [a, b] = await Promise.all([db.doc(`sayHi/${me}`).get(), db.doc(`sayHi/${other}`).get()]);
  if (!a.exists || !b.exists) return null;
  const A = a.data(); const B = b.data();
  return { courses: (A.courses || []).filter((c) => (B.courses || []).includes(c)), orgs: (A.orgs || []).filter((o) => (B.orgs || []).includes(o)) };
}

exports.getSayHi = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'sayhiList', 40);
  const mine = await db.doc(`sayHi/${uid}`).get();
  if (!mine.exists) return { visible: false, people: [] };
  const { courses = [], orgs = [], schoolId = 'ttu' } = mine.data();
  const found = new Map();
  const add = (snap, key, mineList) => snap.docs.forEach((d) => {
    if (d.id === uid) return;
    const v = d.data();
    const shared = (v[key] || []).filter((x) => mineList.includes(x));
    const cur = found.get(d.id) || { courses: [], orgs: [] };
    cur[key] = [...new Set([...cur[key], ...shared])];
    found.set(d.id, cur);
  });
  if (courses.length) add(await db.collection('sayHi').where('schoolId', '==', schoolId).where('courses', 'array-contains-any', courses).limit(80).get(), 'courses', courses);
  if (orgs.length) add(await db.collection('sayHi').where('schoolId', '==', schoolId).where('orgs', 'array-contains-any', orgs).limit(80).get(), 'orgs', orgs);
  const friends = new Set(await C.friendIds(uid));
  const blocked = await C.blockedSet(uid);
  const people = [];
  const ranked = [...found.entries()].sort((a, b) => (b[1].courses.length + b[1].orgs.length) - (a[1].courses.length + a[1].orgs.length));
  for (const [other, shared] of ranked) {
    if (people.length >= 20) break;
    if (friends.has(other) || blocked.has(other)) continue;
    const sent = await db.doc(`introsSent/${uid}_${other}`).get();
    if (sent.exists && Date.now() - (sent.data().at?.toMillis?.() || 0) < 30 * 86400000) continue;
    const [base, card] = await Promise.all([C.basicCard(other), db.doc(`cards/${other}`).get()]);
    const vis = visibleCard(card.exists ? card.data() : null, 0);
    people.push({ uid: other, name: C.firstAndInitial(base.name), avatar: base.avatar, major: vis.major || '', classYear: vis.classYear || '', shared });
  }
  return { visible: true, people };
});

exports.sendSayHi = onCall(C.callOpts(AI), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const to = clean(request.data?.uid, 64);
  if (!to || to === uid) throw new HttpsError('invalid-argument', 'Pick someone to say hi to.');
  await C.takeQuota(uid, 'sayhi', 15, "That's 15 hellos today. Try again tomorrow.");
  if (await C.areFriends(uid, to)) throw new HttpsError('already-exists', "You're already friends.");
  const shared = await sharedWith(uid, to);
  if (!shared || (!shared.courses.length && !shared.orgs.length)) throw new HttpsError('failed-precondition', "You two don't share a class or org on Flyer anymore.");
  if (await C.isBlocked(uid, to)) return { ok: true }; // looks the same as sent
  const note = clean(request.data?.note, 160);
  if (note) {
    const m = await C.moderate({ text: note });
    if (!m.allowed && !m.held) throw new HttpsError('invalid-argument', m.reason || "That note can't be sent. Try different wording.");
  }
  const [me, card] = await Promise.all([C.basicCard(uid), db.doc(`cards/${uid}`).get()]);
  const vis = visibleCard(card.exists ? card.data() : null, 0);
  await db.doc(`users/${to}/intros/${uid}`).set({
    uid, name: C.firstAndInitial(me.name), avatar: me.avatar, major: vis.major || '', classYear: vis.classYear || '', shared, note, at: FieldValue.serverTimestamp(),
  });
  await db.doc(`introsSent/${uid}_${to}`).set({ at: FieldValue.serverTimestamp(), status: 'sent' });
  const first = C.firstAndInitial(me.name).split(' ')[0];
  const what = shared.courses[0] || (shared.orgs[0] ? 'an org' : 'something');
  await C.pushTo([to], { title: `${first} says hi`, body: `You're both in ${what}. Open Flyer to say hi back.`, data: { route: 'intro', uid } });
  return { ok: true };
});

exports.respondSayHi = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const from = clean(request.data?.uid, 64);
  const ref = db.doc(`users/${uid}/intros/${from}`);
  const s = await ref.get();
  if (!s.exists) return { ok: true };
  if (request.data?.accept && !(await C.isBlocked(uid, from))) {
    await C.makeFriends(uid, from);
    await db.doc(`introsSent/${from}_${uid}`).set({ status: 'accepted' }, { merge: true });
    const key = `sayhi:${[uid, from].sort().join('_')}`;
    await Promise.all([C.award(uid, key, 20, { stamp: 'first-hi', label: 'Said hi' }), C.award(from, key, 20, { stamp: 'first-hi', label: 'Said hi' })]);
    const me = await C.basicCard(uid);
    await C.pushTo([from], { title: `${(me.name || 'Someone').split(' ')[0]} said hi back`, body: "You're friends on Flyer now.", data: { route: 'friends' } });
  } else {
    await ref.delete();
    await db.doc(`introsSent/${from}_${uid}`).set({ status: 'declined' }, { merge: true }); // never shown to the sender
  }
  return { ok: true };
});

/* Teammate photo swap: both people agree, and it ends with the project. */
exports.faceSwap = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const other = clean(request.data?.uid, 64);
  const groupId = clean(request.data?.groupId, 40);
  if (!other || other === uid) throw new HttpsError('invalid-argument', 'Pick a teammate.');
  const g = await db.doc(`groups/${groupId}`).get();
  if (!g.exists || !(g.data().members || []).includes(uid) || !(g.data().members || []).includes(other)) throw new HttpsError('permission-denied', 'Photo swaps are for people in the same group.');
  if (await C.isBlocked(uid, other)) return { ok: true, pending: true };
  const [a, b] = [uid, other].sort();
  const ref = db.doc(`faceShares/${a}_${b}`);
  const until = g.data().endsAt || new Date(Date.now() + 120 * 86400000).toISOString();
  const mineKey = uid === a ? 'okA' : 'okB';
  if (request.data?.stop) { await ref.delete().catch(() => {}); return { ok: true, active: false }; }
  await ref.set({ a, b, [mineKey]: true, until, groupId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const now = (await ref.get()).data();
  const active = !!(now.okA && now.okB);
  if (!active) {
    const me = await C.basicCard(uid);
    await C.pushTo([other], { title: `${(me.name || 'A teammate').split(' ')[0]} wants to swap photos`, body: `So you can find each other in ${g.data().name}. Only until the project ends.`, data: { route: 'group', id: groupId } });
  }
  return { ok: true, active };
});

exports.faceSwapStatus = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const groupId = clean(request.data?.groupId, 40);
  const q = await db.collection('faceShares').where('groupId', '==', groupId).get();
  const mine = {};
  q.docs.forEach((d) => {
    const f = d.data();
    if (f.a !== uid && f.b !== uid) return;
    const other = f.a === uid ? f.b : f.a;
    const meOk = f.a === uid ? f.okA : f.okB; const themOk = f.a === uid ? f.okB : f.okA;
    mine[other] = { meOk: !!meOk, themOk: !!themOk, active: !!(meOk && themOk), until: f.until };
  });
  return { swaps: mine };
});

/* ---------------- Flyer Drop ---------------- */
const cellOf = (lat, lng) => [Math.floor(lat * 1800), Math.floor(lng * 1800)];
const cellKey = (a, b) => `${a}_${b}`;
const meters = (a, b) => {
  const R = 6371000; const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat); const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

exports.dropBeacon = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const ref = db.doc(`beacons/${uid}`);
  if (!d.visible) { await ref.delete().catch(() => {}); return { people: [] }; }
  const lat = Number(d.lat); const lng = Number(d.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpsError('invalid-argument', 'Bad location.');
  await C.takeQuota(uid, 'beacon', 600);
  const [cy, cx] = cellOf(lat, lng);
  const me = await C.basicCard(uid);
  await ref.set({ cell: cellKey(cy, cx), lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4, at: Date.now(), name: C.firstAndInitial(me.name), avatar: me.avatar });
  const cells = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) cells.push(cellKey(cy + i, cx + j));
  const q = await db.collection('beacons').where('cell', 'in', cells).get();
  const blocked = await C.blockedSet(uid);
  const friends = new Set(await C.friendIds(uid));
  const people = q.docs.filter((x) => x.id !== uid && !blocked.has(x.id)).map((x) => ({ uid: x.id, ...x.data() }))
    .filter((p) => Date.now() - p.at < 90000 && meters({ lat, lng }, p) <= 80)
    .map((p) => ({ uid: p.uid, name: p.name, avatar: p.avatar, friend: friends.has(p.uid), meters: Math.round(meters({ lat, lng }, p)) }))
    .sort((a, b) => a.meters - b.meters).slice(0, 12);
  return { people };
});

const DROP_KINDS = ['card', 'link', 'note', 'photo', 'file', 'event', 'group', 'plan'];
function cleanDropPayload(kind, p = {}) {
  const out = { title: clean(p.title, 120) };
  if (kind === 'link') { out.url = C.cleanUrl(p.url); if (!out.url) throw new HttpsError('invalid-argument', 'That link needs to start with https://'); }
  if (kind === 'note') { out.text = clean(p.text, 1500); if (!out.text) throw new HttpsError('invalid-argument', 'Write something first.'); }
  if (kind === 'event') { out.when = clean(p.when, 80); out.where = clean(p.where, 120); out.desc = clean(p.desc, 400); out.url = C.cleanUrl(p.url); }
  if (kind === 'group') { out.code = clean(p.code, 12); }
  if (kind === 'plan') { out.id = clean(p.id, 20); }
  if (kind === 'card') { out.handle = clean(p.handle, 30); }
  return out;
}

exports.dropSend = onCall({ ...C.callOpts(AI), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const kind = DROP_KINDS.includes(d.kind) ? d.kind : null;
  if (!kind) throw new HttpsError('invalid-argument', 'Pick something to send.');
  await C.takeQuota(uid, 'drop', 60, "You've sent a lot of drops today. Try again tomorrow.");
  const payload = cleanDropPayload(kind, d.payload);
  const me = await C.basicCard(uid);
  if (kind === 'card') payload.handle = me.handle;
  // Who may receive: friends, people nearby right now, or anyone with the QR link (open).
  const wanted = (Array.isArray(d.to) ? d.to : []).map((x) => clean(x, 64)).filter(Boolean).slice(0, 30);
  const friends = new Set(await C.friendIds(uid));
  const blocked = await C.blockedSet(uid);
  const recipients = [];
  for (const r of wanted) {
    if (r === uid || blocked.has(r)) continue;
    if (friends.has(r)) { recipients.push(r); continue; }
    const b = await db.doc(`beacons/${r}`).get();
    if (b.exists && Date.now() - b.data().at < 180000) recipients.push(r);
  }
  const open = !!d.open;
  if (!open && !recipients.length) throw new HttpsError('failed-precondition', 'Nobody to send to. Pick a friend, someone nearby, or use the QR code.');
  const textToCheck = [payload.title, payload.text, payload.desc, payload.url].filter(Boolean).join('\n');
  let fileUrl = null; let fileType = null;
  if (kind === 'photo' || kind === 'file') {
    const up = await C.readUpload(uid, d.uploadPath, { maxBytes: 15 * 1024 * 1024, types: kind === 'photo' ? undefined : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] });
    if (up.contentType.startsWith('image/')) {
      const m = await C.moderate({ image: up.buf, mediaType: up.contentType, text: textToCheck });
      if (!m.allowed) { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', m.held ? "We couldn't check that photo right now. Try again in a bit." : (m.reason || "That can't be sent.")); }
    } else if (textToCheck) {
      const m = await C.moderate({ text: textToCheck });
      if (!m.allowed && !m.held) throw new HttpsError('invalid-argument', m.reason || "That can't be sent.");
    }
    const id0 = C.shortId(10);
    const ext = up.contentType === 'application/pdf' ? 'pdf' : 'jpg';
    fileUrl = await C.publishFile(up.file, `drops/${id0}/file.${ext}`, up.contentType);
    fileType = up.contentType;
    d.__id = id0;
  } else if (textToCheck) {
    const m = await C.moderate({ text: textToCheck });
    if (!m.allowed && !m.held) throw new HttpsError('invalid-argument', m.reason || "That can't be sent.");
  }
  const id = d.__id || C.shortId(10);
  const now = Date.now();
  await db.doc(`drops/${id}`).set({
    from: uid, fromName: C.firstAndInitial(me.name), fromAvatar: me.avatar, kind, payload, fileUrl, fileType,
    recipients, open, createdAt: FieldValue.serverTimestamp(), expiresAt: new Date(now + (open ? 24 : 168) * 3600000).toISOString(),
  });
  if (recipients.length) {
    const label = { card: 'their Connect card', link: 'a link', note: 'a note', photo: 'a photo', file: 'a file', event: 'an event', group: 'a group invite', plan: 'a plan' }[kind];
    await C.pushTo(recipients, { title: `${me.name.split(' ')[0] || 'Someone'} sent you ${label}`, body: payload.title || 'Open Flyer to see it.', data: { route: 'drop', id }, category: 'drops' });
  }
  return { ok: true, id, url: `${C.shareBase()}/d/${id}` };
});

exports.dropClaim = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const id = clean(request.data?.id, 20).toUpperCase();
  const ref = db.doc(`drops/${id}`);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError('not-found', 'That drop is gone or the code is wrong.');
  const v = s.data();
  if (new Date(v.expiresAt) < new Date()) throw new HttpsError('not-found', 'That drop expired.');
  if (await C.isBlocked(uid, v.from)) throw new HttpsError('not-found', 'That drop is gone or the code is wrong.');
  if (!v.recipients.includes(uid) && v.from !== uid) {
    if (!v.open) throw new HttpsError('not-found', 'That drop is gone or the code is wrong.');
    await ref.update({ recipients: FieldValue.arrayUnion(uid) });
  }
  return { id, ...v, createdAt: null };
});

exports.dropDismiss = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const id = clean(request.data?.id, 20);
  const ref = db.doc(`drops/${id}`);
  const s = await ref.get();
  if (!s.exists) return { ok: true };
  if (s.data().from === uid) { if (s.data().fileUrl) await C.deleteFileByUrl(s.data().fileUrl); await ref.delete(); } else await ref.update({ recipients: FieldValue.arrayRemove(uid) });
  return { ok: true };
});

/* ---------------- Share links ---------------- */
const SHARE_KINDS = ['event', 'plan', 'deal', 'place', 'tip', 'group', 'card', 'post', 'queue'];
exports.createShare = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  await C.takeQuota(uid, 'share', 80);
  const kind = SHARE_KINDS.includes(request.data?.kind) ? request.data.kind : 'event';
  const x = request.data?.data || {};
  const data = {
    title: clean(x.title, 140), when: clean(x.when, 90), where: clean(x.where, 140), desc: clean(x.desc, 500),
    url: C.cleanUrl(x.url), img: C.cleanUrl(x.img), by: clean(x.by, 80), ref: clean(x.ref, 60), startsAt: clean(x.startsAt, 40),
  };
  if (!data.title) throw new HttpsError('invalid-argument', 'Nothing to share.');
  const id = C.shortId(9);
  await db.doc(`shares/${id}`).set({ kind, data, by: uid, createdAt: FieldValue.serverTimestamp() });
  return { id, url: `${C.shareBase()}/s/${id}` };
});

exports.getShare = onCall(C.callOpts(), async (request) => {
  C.requireAuth(request);
  const s = await db.doc(`shares/${clean(request.data?.id, 20)}`).get();
  if (!s.exists) throw new HttpsError('not-found', 'That link has expired.');
  return { kind: s.data().kind, data: s.data().data };
});

/* ---------------- Report + admin ---------------- */
const REPORT_KINDS = ['user', 'post', 'publicPost', 'card', 'drop', 'group', 'intro', 'postcard', 'note', 'plan', 'game', 'deal', 'other'];
exports.report = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  await C.takeQuota(uid, 'report', 30, "Thanks! You've sent a lot of reports today. We'll review them.");
  const d = request.data || {};
  const kind = REPORT_KINDS.includes(d.kind) ? d.kind : 'other';
  const targetId = clean(d.id, 80); const targetUid = clean(d.uid, 64);
  await db.collection('reports').add({ reporter: uid, kind, targetId, targetUid, reason: clean(d.reason, 40), note: clean(d.note, 500), status: 'open', at: FieldValue.serverTimestamp() });
  const countRef = db.doc(`reportCounts/${kind}_${targetId || targetUid}`);
  await countRef.set({ n: FieldValue.increment(1) }, { merge: true });
  const n = ((await countRef.get()).data() || {}).n || 0;
  if (kind === 'publicPost' && targetId && n >= 3) await db.doc(`publicPosts/${targetId}`).update({ status: 'hidden' }).catch(() => {});
  const cfg = await C.appConfig();
  await C.pushTo(cfg.admins || [], { title: 'New report in Flyer', body: `${kind}: ${clean(d.reason, 40) || 'no reason given'}`, data: { route: 'admin' }, category: 'safety' });
  return { ok: true };
});

async function requireAdmin(request) {
  const uid = C.requireAuth(request, { account: true });
  if (!(await C.isAdmin(uid))) throw new HttpsError('permission-denied', 'Admins only.');
  return uid;
}
const rows = (q) => q.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().at?.toDate?.()?.toISOString?.() || d.data().createdAt?.toDate?.()?.toISOString?.() || null }));

exports.amIAdmin = onCall(C.callOpts(), async (request) => {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token?.firebase?.sign_in_provider === 'anonymous') return { admin: false };
  return { admin: await C.isAdmin(uid) };
});

exports.adminQueue = onCall(C.callOpts(), async (request) => {
  await requireAdmin(request);
  const [reports, pending, claims, deals, outdated, errors] = await Promise.all([
    db.collection('reports').where('status', '==', 'open').limit(60).get(),
    db.collection('publicPosts').where('status', '==', 'pending').limit(60).get(),
    db.collection('orgClaims').where('status', '==', 'pending').limit(60).get(),
    db.collection('dealSuggestions').limit(40).get().catch(() => ({ docs: [] })),
    db.collection('outdated').where('status', '==', 'open').limit(40).get().catch(() => ({ docs: [] })),
    db.collection('clientErrors').orderBy('at', 'desc').limit(30).get().catch(() => ({ docs: [] })),
  ]);
  return { reports: rows(reports), pending: rows(pending), claims: rows(claims), deals: rows(deals), outdated: rows(outdated), errors: rows(errors) };
});

async function removeContent(kind, id) {
  if (!id) return;
  if (kind === 'publicPost') { const s = await db.doc(`publicPosts/${id}`).get(); if (s.exists) { await C.deleteFileByUrl(s.data().photoUrl); await s.ref.delete(); } }
  if (kind === 'post' || kind === 'postcard') {
    const s = await db.doc(`posts/${id}`).get();
    if (s.exists) {
      await C.deleteFileByUrl(s.data().photoUrl);
      const fr = await C.friendIds(s.data().uid);
      const batch = db.batch();
      fr.forEach((f) => { batch.delete(db.doc(`users/${f}/feed/${id}`)); batch.delete(db.doc(`users/${f}/postcards/${id}`)); });
      batch.delete(s.ref); await batch.commit();
    }
  }
  if (kind === 'note') { const s = await db.doc(`notes/${id}`).get(); if (s.exists) { await C.deleteFileByUrl(s.data().url); await s.ref.delete(); } }
  if (kind === 'drop') await db.doc(`drops/${id}`).delete().catch(() => {});
}

exports.adminAction = onCall(C.callOpts(), async (request) => {
  await requireAdmin(request);
  const d = request.data || {};
  const id = clean(d.id, 80); const action = clean(d.action, 30);
  if (d.kind === 'report') {
    const r = await db.doc(`reports/${id}`).get();
    if (!r.exists) return { ok: true };
    const v = r.data();
    if (action === 'remove') await removeContent(v.kind, v.targetId);
    if (action === 'ban' && v.targetUid) {
      await db.doc(`users/${v.targetUid}`).set({ banned: true }, { merge: true });
      const posts = await db.collection('publicPosts').where('uid', '==', v.targetUid).get();
      const batch = db.batch(); posts.docs.forEach((p) => batch.delete(p.ref)); await batch.commit();
    }
    await r.ref.update({ status: action === 'dismiss' ? 'dismissed' : 'resolved', resolvedAt: FieldValue.serverTimestamp(), action });
  } else if (d.kind === 'publicPost') {
    await db.doc(`publicPosts/${id}`).update({ status: action === 'approve' ? 'live' : 'rejected' });
  } else if (d.kind === 'orgClaim') {
    const c = await db.doc(`orgClaims/${id}`).get();
    if (c.exists) {
      await c.ref.update({ status: action === 'approve' ? 'approved' : 'rejected' });
      if (action === 'approve') {
        await db.doc(`orgAdmins/${c.data().orgId}`).set({ orgName: c.data().orgName, uids: FieldValue.arrayUnion(c.data().uid) }, { merge: true });
        await C.pushTo([c.data().uid], { title: `You're confirmed for ${c.data().orgName}`, body: 'You can now post events as your org and print poster QR codes.', data: { route: 'org', id: c.data().orgId } });
      }
    }
  } else if (d.kind === 'deal') {
    await db.doc(`dealSuggestions/${id}`).delete().catch(() => {});
  } else if (d.kind === 'outdated') {
    await db.doc(`outdated/${id}`).update({ status: 'resolved' }).catch(() => {});
  }
  return { ok: true };
});

/* ---------------- Org claims (simple version: you approve them) ---------------- */
exports.claimOrg = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'claim', 5);
  const d = request.data || {};
  const orgId = clean(d.orgId, 80); const orgName = clean(d.orgName, 120);
  if (!orgId || !orgName) throw new HttpsError('invalid-argument', 'Pick your org.');
  const existing = await db.doc(`orgAdmins/${orgId}`).get();
  if (existing.exists && (existing.data().uids || []).includes(uid)) return { ok: true, status: 'approved' };
  await db.collection('orgClaims').add({ uid, orgId, orgName, role: clean(d.role, 60), email: clean(d.email, 120), note: clean(d.note, 400), status: 'pending', at: FieldValue.serverTimestamp() });
  const cfg = await C.appConfig();
  await C.pushTo(cfg.admins || [], { title: 'New org claim', body: `${orgName}: ${clean(d.role, 60)}`, data: { route: 'admin' }, category: 'safety' });
  return { ok: true, status: 'pending' };
});

exports.myOrgs = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const [approved, pending] = await Promise.all([
    db.collection('orgAdmins').where('uids', 'array-contains', uid).get(),
    db.collection('orgClaims').where('uid', '==', uid).where('status', '==', 'pending').get(),
  ]);
  return { orgs: approved.docs.map((d) => ({ orgId: d.id, orgName: d.data().orgName })), pending: pending.docs.map((d) => ({ orgId: d.data().orgId, orgName: d.data().orgName })) };
});

/* ---------------- Outdated hub info ---------------- */
exports.reportOutdated = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  await C.takeQuota(uid, 'outdated', 10);
  const d = request.data || {};
  await db.collection('outdated').add({ uid, itemId: clean(d.itemId, 80), title: clean(d.title, 140), url: clean(d.url, 400), note: clean(d.note, 400), status: 'open', at: FieldValue.serverTimestamp() });
  return { ok: true };
});

/* ---------------- What Flyer knows about you ---------------- */
async function count(q) { try { const s = await q.count().get(); return s.data().count; } catch (e) { const s = await q.get(); return s.size; } }

exports.myData = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const [user, card, sayHi, loc, classmates, score, push] = await Promise.all([
    db.doc(`users/${uid}`).get(), db.doc(`cards/${uid}`).get(), db.doc(`sayHi/${uid}`).get(), db.doc(`locations/${uid}`).get(),
    db.doc(`classmates/${uid}`).get(), db.doc(`scores/${uid}`).get(), db.doc(`pushTokens/${uid}`).get(),
  ]);
  const [friends, requests, intros, posts, saved, publicPosts, groups, drops, reports, notes, walks] = await Promise.all([
    count(db.collection(`users/${uid}/friends`)), count(db.collection(`users/${uid}/requests`)), count(db.collection(`users/${uid}/intros`)),
    count(db.collection('posts').where('uid', '==', uid)), count(db.collection('posts').where('uid', '==', uid).where('saved', '==', true)),
    count(db.collection('publicPosts').where('uid', '==', uid)), count(db.collection('groups').where('members', 'array-contains', uid)),
    count(db.collection('drops').where('from', '==', uid)), count(db.collection('reports').where('reporter', '==', uid)),
    count(db.collection('notes').where('uid', '==', uid)), count(db.collection('walks').where('uid', '==', uid)),
  ]);
  const u = user.exists ? user.data() : {};
  const c = card.exists ? card.data() : {};
  return {
    profile: { name: u.name || '', handle: u.handle || '', school: u.schoolId || '', plus: !!u.plus },
    card: { fields: ['headline', 'major', 'email', 'phone'].filter((k) => c[k]).length + (c.orgs || []).length + (c.links || []).length, face: !!c.faceUrl },
    sayHi: sayHi.exists ? { courses: (sayHi.data().courses || []).length, orgs: (sayHi.data().orgs || []).length } : null,
    location: loc.exists ? { sharingWith: (loc.data().allowed || []).length } : null,
    classmates: classmates.exists ? (classmates.data().courses || []).length : 0,
    score: score.exists ? { points: score.data().points || 0, stamps: (score.data().stamps || []).length, onLeaderboard: !!score.data().public } : null,
    pushDevices: push.exists ? (push.data().tokens || []).length : 0,
    counts: { friends, requests, intros, posts, saved, publicPosts, groups, drops, reports, notes, walks },
  };
});

exports.deleteMyData = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const what = clean(request.data?.what, 30);
  const delQuery = async (q) => { const s = await q.get(); for (let i = 0; i < s.docs.length; i += 400) { const b = db.batch(); s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); } return s.docs; };
  if (what === 'posts') {
    const mine = await db.collection('posts').where('uid', '==', uid).get();
    const fr = await C.friendIds(uid);
    for (const p of mine.docs) {
      await C.deleteFileByUrl(p.data().photoUrl);
      const b = db.batch(); fr.forEach((f) => { b.delete(db.doc(`users/${f}/feed/${p.id}`)); b.delete(db.doc(`users/${f}/postcards/${p.id}`)); }); b.delete(p.ref); await b.commit();
    }
  } else if (what === 'card') {
    const c = await db.doc(`cards/${uid}`).get();
    if (c.exists && c.data().faceUrl) await C.deleteFileByUrl(c.data().faceUrl);
    const u = await C.basicCard(uid);
    await Promise.all([db.doc(`cards/${uid}`).delete(), u.handle ? db.doc(`publicCards/${u.handle}`).delete() : null].filter(Boolean));
  } else if (what === 'sayhi') {
    await db.doc(`sayHi/${uid}`).delete().catch(() => {});
    await delQuery(db.collection(`users/${uid}/intros`));
  } else if (what === 'public') {
    const docs = await delQuery(db.collection('publicPosts').where('uid', '==', uid));
    await Promise.all(docs.map((d) => C.deleteFileByUrl(d.data().photoUrl)));
  } else if (what === 'score') {
    await delQuery(db.collection(`scores/${uid}/ledger`));
    await db.doc(`scores/${uid}`).delete().catch(() => {});
  } else if (what === 'location') {
    await db.doc(`locations/${uid}`).delete().catch(() => {});
    await db.doc(`beacons/${uid}`).delete().catch(() => {});
  } else if (what === 'classmates') {
    await db.doc(`classmates/${uid}`).delete().catch(() => {});
  } else if (what === 'push') {
    await db.doc(`pushTokens/${uid}`).delete().catch(() => {});
  } else if (what === 'notes') {
    const docs = await delQuery(db.collection('notes').where('uid', '==', uid));
    await Promise.all(docs.map((d) => C.deleteFileByUrl(d.data().url)));
  } else throw new HttpsError('invalid-argument', 'Pick what to delete.');
  return { ok: true };
});

/* ---------------- Housekeeping ---------------- */
exports.cleanupDrops = onSchedule('every 6 hours', async () => {
  const now = new Date().toISOString();
  const old = await db.collection('drops').where('expiresAt', '<', now).limit(300).get();
  for (const d of old.docs) {
    if (d.data().fileUrl) await C.deleteFileByUrl(d.data().fileUrl);
    await d.ref.delete();
  }
  const staleBeacons = await db.collection('beacons').where('at', '<', Date.now() - 3600000).limit(400).get();
  const b = db.batch(); staleBeacons.docs.forEach((x) => b.delete(x.ref)); if (staleBeacons.size) await b.commit();
  const tokens = await db.collection('walletTokens').where('exp', '<', Date.now()).limit(400).get();
  const b2 = db.batch(); tokens.docs.forEach((x) => b2.delete(x.ref)); if (tokens.size) await b2.commit();
  // Error reports are kept 90 days (privacy policy).
  const errs = await db.collection('clientErrors').where('at', '<', new Date(Date.now() - 90 * 24 * 3600000)).limit(400).get().catch(() => ({ docs: [], size: 0 }));
  const b3 = db.batch(); errs.docs.forEach((x) => b3.delete(x.ref)); if (errs.size) await b3.commit();
});

