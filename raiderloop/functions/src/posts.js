/**
 * Posts and places:
 *   • friends-only posts that leave friends' feeds after 24 hours
 *   • Story (posts you chose to keep) and your College Journey
 *   • Postcards: photos pinned to a spot, shown on friends' maps
 *   • Discover's public lanes: event posts, Good to Know tips, and
 *     short "right now" posts (free pizza, etc.)
 *   • status taps (printer out, elevator out, long line, lot full)
 *   • class notes for the missed-class kit
 *
 * Everything other people see is moderated first (common.moderate).
 */
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const C = require('./common');
const { huntById, liveHunts } = require('./lib/hunts');

const { db, FieldValue, HttpsError, clean } = C;
const AI = [C.ANTHROPIC_API_KEY];
const HOUR = 3600000;

async function notBanned(uid) {
  const u = await db.doc(`users/${uid}`).get();
  if (u.exists && u.data().banned) throw new HttpsError('permission-denied', "Posting is turned off for this account. Contact support if you think that's a mistake.");
  return u.exists ? u.data() : {};
}
const cleanPlace = (p) => {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(p.lat); const lng = Number(p.lng);
  const out = { name: clean(p.name, 100), buildingId: clean(p.buildingId, 80) || null };
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) { out.lat = Math.round(lat * 1e4) / 1e4; out.lng = Math.round(lng * 1e4) / 1e4; }
  return out.name || out.lat != null ? out : null;
};
const iso = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/* ---------------- Friends-only posts ---------------- */
const POST_KINDS = ['moment', 'postcard', 'hunt', 'scrapbook'];

exports.createPost = onCall({ ...C.callOpts(AI), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await notBanned(uid);
  const d = request.data || {};
  const kind = POST_KINDS.includes(d.kind) ? d.kind : 'moment';
  await C.takeQuota(uid, 'post', 25, "That's a lot of posts for one day. Try again tomorrow.");
  const caption = clean(d.caption, 300);
  const place = cleanPlace(d.place);
  let hunt = null; let item = null;
  if (kind === 'hunt') {
    hunt = huntById(clean(d.huntId, 30));
    item = hunt && hunt.items.find((i) => i.id === clean(d.itemId, 30));
    if (!hunt || !item || !liveHunts().some((h) => h.id === hunt.id)) throw new HttpsError('failed-precondition', "That hunt isn't running right now.");
  }
  const up = await C.readUpload(uid, d.uploadPath);
  const m = await C.moderate({ image: up.buf, mediaType: up.contentType, text: caption, question: item ? item.check : '' });
  const reject = async (msg) => { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', msg); };
  if (m.held) await reject("We couldn't check that photo right now. Try again in a few minutes.");
  if (!m.allowed) await reject(m.reason || "That photo can't be posted.");
  if ((kind === 'hunt' || d.alsoTip) && m.hasPeople) await reject('Hunts and building tips are objects and places only. Try a shot without people in it.');
  if (kind === 'hunt' && !m.matches) await reject(`That doesn't look like "${item.label.toLowerCase()}" yet. Try another shot.`);

  const me = await C.basicCard(uid);
  const id = C.shortId(12);
  const photoUrl = await C.publishFile(up.file, `media/${uid}/${id}.jpg`, up.contentType);
  const now = Date.now();
  const post = {
    uid, name: me.name, avatar: me.avatar, caption, photoUrl, kind, place,
    huntId: hunt ? hunt.id : null, itemId: item ? item.id : null, itemLabel: item ? item.label : null,
    createdAt: FieldValue.serverTimestamp(), createdMs: now, expiresAt: new Date(now + 24 * HOUR).toISOString(), saved: kind === 'scrapbook',
  };
  await db.doc(`posts/${id}`).set(post);

  // Fan out to friends: their feed (24 h) and, for postcards, their map.
  const user = await db.doc(`users/${uid}`).get();
  const postcardsOn = !(user.exists && user.data().prefs && user.data().prefs.postcardsToFriends === false);
  const friends = await C.friendIds(uid);
  const lite = { postId: id, uid, name: me.name, avatar: me.avatar, caption, photoUrl, kind, place, itemLabel: post.itemLabel, createdMs: now, expiresAt: post.expiresAt };
  for (let i = 0; i < friends.length; i += 200) {
    const batch = db.batch();
    friends.slice(i, i + 200).forEach((f) => {
      batch.set(db.doc(`users/${f}/feed/${id}`), lite);
      if (kind === 'postcard' && postcardsOn && place && place.lat != null) batch.set(db.doc(`users/${f}/postcards/${id}`), { ...lite, expiresAt: null });
    });
    await batch.commit();
  }

  // A postcard can also become a public building tip ("the door you actually use").
  if (kind === 'postcard' && d.alsoTip && place && place.buildingId) {
    const tipId = C.shortId(12);
    const src = C.bucket().file(`media/${uid}/${id}.jpg`);
    const tmp = C.bucket().file(`uploads/${uid}/tip-${tipId}.jpg`);
    await src.copy(tmp);
    const tipUrl = await C.publishFile(tmp, `public/${tipId}.jpg`, up.contentType);
    await db.doc(`publicPosts/${tipId}`).set({
      uid, name: C.firstAndInitial(me.name), avatar: me.avatar, kind: 'tip', title: caption || `Tip for ${place.name}`, body: '', place, area: 'campus',
      photoUrl: tipUrl, helpful: 0, going: 0, status: 'live', createdAt: FieldValue.serverTimestamp(), createdMs: now, expiresAt: new Date(now + 365 * 24 * HOUR).toISOString(), when: null,
    });
  }

  // Flight Score
  let points = 0;
  if (kind === 'hunt') {
    if (await C.award(uid, `hunt:${C.seasonId()}:${hunt.id}:${item.id}`, 50, { label: `${hunt.title}: ${item.label}` })) points += 50;
    const done = await db.collection(`scores/${uid}/ledger`).where('season', '==', C.seasonId()).get();
    const have = new Set(done.docs.map((x) => x.id));
    if (hunt.items.every((it) => have.has(`hunt:${C.seasonId()}:${hunt.id}:${it.id}`))) {
      if (await C.award(uid, `huntdone:${C.seasonId()}:${hunt.id}`, hunt.bonus, { stamp: `hunt-${hunt.id}`, label: `Finished ${hunt.title}` })) points += hunt.bonus;
    }
  } else if (kind === 'postcard') {
    if (await C.award(uid, 'first-postcard', 25, { stamp: 'first-postcard', label: 'First postcard' })) points += 25;
  } else if (kind === 'moment') {
    if (await C.award(uid, `moment:${C.today()}`, 5, { label: 'Shared a moment' })) points += 5;
  }
  return { ok: true, id, photoUrl, points };
});

exports.savePost = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const id = clean(request.data?.id, 20);
  const ref = db.doc(`posts/${id}`);
  const s = await ref.get();
  if (!s.exists || s.data().uid !== uid) throw new HttpsError('not-found', 'Post not found.');
  await ref.update({ saved: !!request.data?.saved });
  return { ok: true };
});

async function deletePostEverywhere(id, data) {
  await C.deleteFileByUrl(data.photoUrl);
  const friends = await C.friendIds(data.uid);
  for (let i = 0; i < friends.length; i += 200) {
    const batch = db.batch();
    friends.slice(i, i + 200).forEach((f) => { batch.delete(db.doc(`users/${f}/feed/${id}`)); batch.delete(db.doc(`users/${f}/postcards/${id}`)); });
    await batch.commit();
  }
  await db.doc(`posts/${id}`).delete();
}

exports.deletePost = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const id = clean(request.data?.id, 20);
  const s = await db.doc(`posts/${id}`).get();
  if (!s.exists) return { ok: true };
  if (s.data().uid !== uid && !(await C.isAdmin(uid))) throw new HttpsError('permission-denied', 'Only the person who posted it can delete it.');
  await deletePostEverywhere(id, s.data());
  return { ok: true };
});

/* A friend's Story: the posts they chose to keep. */
exports.getStory = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const owner = clean(request.data?.uid, 64) || uid;
  if (owner !== uid && !(await C.areFriends(uid, owner))) throw new HttpsError('permission-denied', 'Stories are for friends.');
  const q = await db.collection('posts').where('uid', '==', owner).where('saved', '==', true).orderBy('createdMs', 'desc').limit(80).get();
  return { posts: q.docs.map((d) => { const v = d.data(); return { id: d.id, caption: v.caption, photoUrl: v.photoUrl, kind: v.kind, place: v.place, itemLabel: v.itemLabel, createdMs: v.createdMs }; }) };
});

exports.setPrivacyPrefs = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const prefs = {};
  ['postcardsToFriends', 'storyToFriends'].forEach((k) => { if (typeof d[k] === 'boolean') prefs[k] = d[k]; });
  await db.doc(`users/${uid}`).set({ prefs }, { merge: true });
  if (prefs.postcardsToFriends === false) {
    // Take my postcards off friends' maps now.
    const friends = await C.friendIds(uid);
    for (const f of friends) {
      const q = await db.collection(`users/${f}/postcards`).where('uid', '==', uid).get();
      if (q.size) { const b = db.batch(); q.docs.forEach((x) => b.delete(x.ref)); await b.commit(); }
    }
  }
  return { ok: true };
});

/* ---------------- Discover: public posts ---------------- */
const PUBLIC_KINDS = ['event', 'tip', 'now'];
const AREAS = ['campus', 'near', 'lubbock'];

exports.createPublicPost = onCall({ ...C.callOpts(AI), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await notBanned(uid);
  const d = request.data || {};
  const kind = PUBLIC_KINDS.includes(d.kind) ? d.kind : null;
  if (!kind) throw new HttpsError('invalid-argument', 'Pick what kind of post this is.');
  await C.takeQuota(uid, 'public', 6, "You've posted 6 times today. That's the daily limit for Discover.");
  const title = clean(d.title, 120); const body = clean(d.body, 600);
  if (title.length < 3) throw new HttpsError('invalid-argument', 'Add a short title.');
  const place = cleanPlace(d.place);
  const area = AREAS.includes(d.area) ? d.area : 'campus';
  const now = Date.now();
  let when = null; let expiresAt;
  if (kind === 'event') {
    when = iso(d.when);
    if (!when || Date.parse(when) < now - HOUR || Date.parse(when) > now + 150 * 24 * HOUR) throw new HttpsError('invalid-argument', 'Pick a date and time for the event.');
    const end = iso(d.endsAt);
    expiresAt = new Date((end && Date.parse(end) > Date.parse(when) ? Date.parse(end) : Date.parse(when) + 3 * HOUR) + HOUR).toISOString();
  } else if (kind === 'now') {
    const hours = Math.min(4, Math.max(1, Number(d.hours) || 2));
    expiresAt = new Date(now + hours * HOUR).toISOString();
  } else {
    expiresAt = new Date(now + 120 * 24 * HOUR).toISOString();
  }
  let orgId = null; let orgName = null; let verified = false;
  if (d.orgId) {
    const o = await db.doc(`orgAdmins/${clean(d.orgId, 80)}`).get();
    if (!o.exists || !(o.data().uids || []).includes(uid)) throw new HttpsError('permission-denied', "You're not confirmed for that org yet.");
    orgId = o.id; orgName = o.data().orgName || ''; verified = true;
  }
  let photoUrl = null; let m;
  if (d.uploadPath) {
    const up = await C.readUpload(uid, d.uploadPath);
    m = await C.moderate({ image: up.buf, mediaType: up.contentType, text: `${title}\n${body}` });
    if (!m.allowed && !m.held) { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', m.reason || "That can't be posted."); }
    if (kind === 'tip' && m.hasPeople) { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', 'Good to Know photos are objects and places only.'); }
    photoUrl = await C.publishFile(up.file, `public/${C.shortId(12)}.jpg`, up.contentType);
  } else {
    m = await C.moderate({ text: `${title}\n${body}` });
    if (!m.allowed && !m.held) throw new HttpsError('invalid-argument', m.reason || "That can't be posted.");
  }
  const me = await C.basicCard(uid);
  const id = C.shortId(12);
  const status = m.held ? 'pending' : 'live';
  await db.doc(`publicPosts/${id}`).set({
    uid, name: verified ? orgName : C.firstAndInitial(me.name), avatar: me.avatar, kind, title, body, when, expiresAt, place, area, photoUrl,
    helpful: 0, going: 0, orgId, orgName, verified, status, createdAt: FieldValue.serverTimestamp(), createdMs: now,
  });
  return { ok: true, id, status };
});

exports.deletePublicPost = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const id = clean(request.data?.id, 20);
  const s = await db.doc(`publicPosts/${id}`).get();
  if (!s.exists) return { ok: true };
  if (s.data().uid !== uid && !(await C.isAdmin(uid))) throw new HttpsError('permission-denied', 'Only the person who posted it can delete it.');
  await C.deleteFileByUrl(s.data().photoUrl);
  await s.ref.delete();
  return { ok: true };
});

exports.markHelpful = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const id = clean(request.data?.id, 20);
  const vote = db.doc(`helpfulVotes/${id}_${uid}`);
  const post = db.doc(`publicPosts/${id}`);
  let owner = null;
  await db.runTransaction(async (tx) => {
    const [v, p] = await Promise.all([tx.get(vote), tx.get(post)]);
    if (!p.exists || v.exists) return;
    owner = p.data().uid;
    tx.set(vote, { at: FieldValue.serverTimestamp() });
    tx.update(post, { helpful: FieldValue.increment(1) });
  });
  if (owner && owner !== uid) await C.award(owner, `helpful:${id}:${uid}`, 5, { label: 'Someone found your tip helpful' });
  return { ok: true };
});

exports.setGoing = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const id = clean(request.data?.id, 20);
  const going = !!request.data?.going;
  const mark = db.doc(`goingMarks/${id}_${uid}`);
  const post = db.doc(`publicPosts/${id}`);
  await db.runTransaction(async (tx) => {
    const [m, p] = await Promise.all([tx.get(mark), tx.get(post)]);
    if (!p.exists) return;
    if (going && !m.exists) { tx.set(mark, { uid, id, at: FieldValue.serverTimestamp() }); tx.update(post, { going: FieldValue.increment(1) }); }
    if (!going && m.exists) { tx.delete(mark); tx.update(post, { going: FieldValue.increment(-1) }); }
  });
  return { ok: true };
});

/* ---------------- Status taps ---------------- */
const STATUS_KINDS = {
  printer: ['working', 'out'], elevator: ['working', 'out'], line: ['short', 'medium', 'long'],
  seats: ['plenty', 'few', 'full'], lot: ['open', 'filling', 'full'], wifi: ['good', 'spotty', 'down'],
};
exports.tapStatus = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const d = request.data || {};
  const placeId = clean(d.placeId, 80).replace(/[/.]/g, '-');
  const kind = Object.keys(STATUS_KINDS).includes(d.kind) ? d.kind : null;
  if (!placeId || !kind || !STATUS_KINDS[kind].includes(d.value)) throw new HttpsError('invalid-argument', 'Pick a status.');
  await C.takeQuota(uid, 'status', 60);
  const cool = db.doc(`statusTaps/${placeId}_${kind}_${uid}`);
  const ref = db.doc(`status/${placeId}`);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const [c, s] = await Promise.all([tx.get(cool), tx.get(ref)]);
    if (c.exists && now - c.data().at < 10 * 60000) return;
    const cur = (s.exists && s.data()[kind]) || { recent: [] };
    const recent = [...(cur.recent || []).filter((r) => now - r.at < 30 * 60000), { v: d.value, at: now }].slice(-12);
    const tally = recent.reduce((acc, r) => { acc[r.v] = (acc[r.v] || 0) + 1; return acc; }, {});
    const value = Object.entries(tally).sort((a, b) => b[1] - a[1] || 0)[0][0];
    tx.set(cool, { at: now });
    tx.set(ref, { [kind]: { value, at: now, n: recent.length, recent }, updatedMs: now }, { merge: true });
  });
  return { ok: true };
});

/* ---------------- Class notes (missed-class kit) ---------------- */
const normCourse = (c) => clean(c, 16).toUpperCase().replace(/\s+/g, ' ');
const validCourse = (c) => /^[A-Z]{2,5} \d{4}$/.test(c);

exports.shareNotes = onCall({ ...C.callOpts(AI), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await notBanned(uid);
  const d = request.data || {};
  const course = normCourse(d.course);
  if (!validCourse(course)) throw new HttpsError('invalid-argument', 'Use a course code like MATH 1314.');
  await C.takeQuota(uid, 'notes', 20);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : C.today();
  const title = clean(d.title, 120); const text = clean(d.text, 2000);
  const url = d.url ? C.cleanUrl(d.url) : '';
  let kind = 'text'; let fileUrl = null;
  if (d.uploadPath) {
    const up = await C.readUpload(uid, d.uploadPath, { maxBytes: 15 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] });
    if (up.contentType.startsWith('image/')) {
      const m = await C.moderate({ image: up.buf, mediaType: up.contentType, text: `${title}\n${text}` });
      if (!m.allowed) { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', m.held ? 'Try again in a few minutes.' : (m.reason || "That can't be shared.")); }
    }
    kind = up.contentType === 'application/pdf' ? 'pdf' : 'photo';
    fileUrl = await C.publishFile(up.file, `notes/${C.shortId(12)}.${kind === 'pdf' ? 'pdf' : 'jpg'}`, up.contentType);
  } else if (url) {
    kind = 'link';
  } else if (!text) throw new HttpsError('invalid-argument', 'Add a photo, a link, or some notes.');
  if (!d.uploadPath && (title || text || url)) {
    const m = await C.moderate({ text: `${title}\n${text}\n${url}` });
    if (!m.allowed && !m.held) throw new HttpsError('invalid-argument', m.reason || "That can't be shared.");
  }
  const me = await C.basicCard(uid);
  const id = C.shortId(12);
  await db.doc(`notes/${id}`).set({ uid, name: C.firstAndInitial(me.name), course, date, kind, title, text, url: fileUrl || url || null, createdAt: FieldValue.serverTimestamp(), createdMs: Date.now() });
  const points = (await C.award(uid, `notes:${course}:${date}`, 10, { stamp: 'note-hero', label: `Shared notes for ${course}` })) ? 10 : 0;
  return { ok: true, id, points };
});

exports.getClassNotes = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const course = normCourse(request.data?.course);
  if (!validCourse(course)) throw new HttpsError('invalid-argument', 'Use a course code like MATH 1314.');
  const mine = await db.doc(`classmates/${uid}`).get();
  const optedIn = mine.exists && (mine.data().courses || []).includes(course);
  const friends = new Set(await C.friendIds(uid));
  const blocked = await C.blockedSet(uid);
  const q = await db.collection('notes').where('course', '==', course).orderBy('createdMs', 'desc').limit(60).get();
  const notes = q.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: null }))
    .filter((n) => !blocked.has(n.uid) && (n.uid === uid || friends.has(n.uid) || optedIn));
  return { optedIn, notes };
});

exports.askNotes = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const course = normCourse(request.data?.course);
  if (!validCourse(course)) throw new HttpsError('invalid-argument', 'Use a course code like MATH 1314.');
  await C.takeQuota(uid, 'askNotes', 3, "You've asked 3 times today. Try again tomorrow.");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(request.data?.date) ? request.data.date : C.today();
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const q = await db.collection('classmates').where('courses', 'array-contains', course).limit(40).get();
  const blocked = await C.blockedSet(uid);
  const to = q.docs.map((d) => d.id).filter((x) => x !== uid && !blocked.has(x));
  await db.collection('noteAsks').add({ uid, course, date, n: to.length, at: FieldValue.serverTimestamp() });
  await C.pushTo(to, { title: `Notes from ${course}?`, body: `A classmate missed ${day}'s class. If you took notes, you can share them in Flyer.`, data: { route: 'notes', course, date } });
  return { ok: true, asked: to.length };
});

/* ---------------- Housekeeping ---------------- */
exports.cleanupPosts = onSchedule('every 60 minutes', async () => {
  const now = new Date().toISOString();
  const feed = await db.collectionGroup('feed').where('expiresAt', '<', now).limit(450).get().catch(() => ({ docs: [], size: 0 }));
  if (feed.size) { const b = db.batch(); feed.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
  const pub = await db.collection('publicPosts').where('expiresAt', '<', now).limit(200).get();
  for (const p of pub.docs) { await C.deleteFileByUrl(p.data().photoUrl); await p.ref.delete(); }
  const taps = await db.collection('statusTaps').where('at', '<', Date.now() - 2 * HOUR).limit(400).get();
  if (taps.size) { const b = db.batch(); taps.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
});

