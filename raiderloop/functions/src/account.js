/**
 * Account deletion and "Download my data".
 * ------------------------------------------------------------
 * Apple requires in-app account deletion that really deletes. This
 * removes everything Flyer stores about you on the server, then
 * deletes your sign-in itself with the Admin SDK (so it works even
 * if you last signed in weeks ago). Flyer Plus is billed by Apple,
 * so the app separately tells you to cancel it in Settings.
 */
const { onCall } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const C = require('./common');
const S = require('./socialCore');
const K = require('./chatCore');

const { db, FieldValue, HttpsError } = C;

async function subtractRating(ratingDoc) {
  const r = ratingDoc.data();
  const sumsRef = db.doc(`ratingSums/${r.placeId}`);
  const pubRef = db.doc(`placeRatings/${r.placeId}`);
  await db.runTransaction(async (tx) => {
    const ss = await tx.get(sumsRef);
    if (!ss.exists) return;
    const sums = ss.data();
    for (const cat of ['study', 'food']) {
      if (!r[cat] || !sums[cat]) continue;
      const c = { ...sums[cat] };
      for (const [k, v] of Object.entries(r[cat])) c[k] = Math.max(0, (c[k] || 0) - v);
      c.n = Math.max(0, (c.n || 0) - 1);
      sums[cat] = c;
    }
    tx.set(sumsRef, sums);
    const pub = {};
    const fields = { study: ['quiet', 'seating', 'outlets'], food: ['taste', 'value', 'wait'] };
    for (const [cat, keys] of Object.entries(fields)) {
      const c = sums[cat] || {}; const n = c.n || 0;
      if (n < 5) { pub[cat] = { n, ready: false }; continue; }
      const v = { n, ready: true }; let tot = 0;
      for (const k of keys) { v[k] = Math.round(((c[k] || 0) / n) * 10) / 10; tot += v[k]; }
      v.overall = Math.round((tot / keys.length) * 10) / 10;
      pub[cat] = v;
    }
    tx.set(pubRef, pub, { merge: true });
  });
}

exports.deleteAccount = onCall({ ...C.callOpts(), timeoutSeconds: 300 }, async (request) => {
  const uid = C.requireAuth(request);
  const del = (p) => db.doc(p).delete().catch(() => {});

  // Friends and everything they could see.
  const friends = await db.collection(`users/${uid}/friends`).get();
  for (const f of friends.docs) await S.unfriend(uid, f.id);
  await S.deleteQuery(db.collection(`users/${uid}/requests`));
  // Requests I sent that are still waiting in other people's lists.
  await S.deleteQuery(db.collectionGroup('requests').where('fromUid', '==', uid));
  // My email on any "add my school" request.
  await S.deleteQuery(db.collectionGroup('emails').where('uid', '==', uid));
  await S.deleteQuery(db.collection(`users/${uid}/blocked`));
  const user = await db.doc(`users/${uid}`).get();
  if (user.exists && user.data().handle) await del(`handles/${user.data().handle}`);
  // Old usernames still on hold after a change.
  await S.deleteQuery(db.collection('handles').where('uid', '==', uid));
  await S.deleteQuery(db.collection('friendCodes').where('uid', '==', uid));

  // Ratings come out of the public averages, not just my copy.
  await S.deleteQuery(db.collection('ratings').where('uid', '==', uid), subtractRating);

  // Meetups: mine are deleted; I'm removed from others'.
  const meets = await db.collection('meetups').where('members', 'array-contains', uid).get();
  for (const m of meets.docs) {
    if (m.data().from === uid || m.data().members.length <= 2) await m.ref.delete();
    else await m.ref.update({ members: FieldValue.arrayRemove(uid), [`status.${uid}`]: FieldValue.delete(), [`checkedIn.${uid}`]: FieldValue.delete() });
  }

  // Chats: DMs are deleted entirely; in flocks my messages and photos go.
  const chats = await db.collection('chats').where('members', 'array-contains', uid).get();
  for (const c of chats.docs) {
    const d = c.data();
    if (d.type === 'dm') { await K.deleteChatDeep(c.id); continue; }
    await S.deleteQuery(c.ref.collection('messages').where('from', '==', uid));
    await K.bucket().deleteFiles({ prefix: `chatImages/${c.id}/${uid}/` }).catch(() => {});
    const members = (d.members || []).filter((m) => m !== uid);
    if (!members.length) { await K.deleteChatDeep(c.id); continue; }
    let admins = (d.admins || []).filter((a) => a !== uid);
    if (!admins.length) admins = [members[0]];
    await c.ref.update({ members, admins, [`memberCards.${uid}`]: FieldValue.delete() });
  }

  // My reports stay (so moderation history isn't lost) but no longer name me.
  const reps = await db.collection('reports').where('by', '==', uid).get();
  await Promise.all(reps.docs.map((r) => r.ref.update({ by: 'deleted-user' })));
  await S.deleteQuery(db.collection('usage').where('uid', '==', uid));

  await Promise.all([
    `users/${uid}`, `locations/${uid}`, `classmates/${uid}`, `private/${uid}`, `flight/${uid}`, `pushTokens/${uid}`,
    `schedules/${uid}`, `schedulesFull/${uid}`, `nearby/${uid}`,
  ].map(del));

  // Last: the sign-in itself.
  await getAuth().deleteUser(uid).catch((e) => { if (e.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Your data was deleted, but the sign-in could not be. Try again.'); });
  return { ok: true };
});

/* Everything Flyer's server holds about you, as JSON. (Your planner,
   grades and settings live only on your phone, and are included by
   the app from there.) */
exports.exportMyData = onCall({ ...C.callOpts(), timeoutSeconds: 120 }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'export', 3, 'You can download your data 3 times a day.');
  const get = async (p) => { const s = await db.doc(p).get(); return s.exists ? s.data() : null; };
  const list = async (q, fn = (d) => ({ id: d.id, ...d.data() })) => (await q.get()).docs.map(fn);
  const chats = await list(db.collection('chats').where('members', 'array-contains', uid));
  const messages = [];
  for (const c of chats) {
    const mine = await list(db.collection(`chats/${c.id}/messages`).where('from', '==', uid).limit(1000));
    messages.push(...mine.map((m) => ({ chat: c.type === 'flock' ? c.name : 'Direct message', text: m.text || null, card: m.card || null, photo: m.image ? m.image.path : null, at: m.atMs ? new Date(m.atMs).toISOString() : null })));
  }
  const data = {
    exportedAt: new Date().toISOString(),
    profile: await get(`users/${uid}`),
    friends: await list(db.collection(`users/${uid}/friends`), (d) => ({ name: d.data().name, handle: d.data().handle })),
    blocked: (await db.collection(`users/${uid}/blocked`).get()).size,
    flight: await get(`flight/${uid}`),
    ratings: await list(db.collection('ratings').where('uid', '==', uid), (d) => { const r = d.data(); return { place: r.placeId, study: r.study || null, food: r.food || null }; }),
    meetups: await list(db.collection('meetups').where('members', 'array-contains', uid), (d) => { const m = d.data(); return { place: m.placeName, at: new Date(m.atMs).toISOString(), status: m.status[uid] }; }),
    chats: chats.map((c) => ({ type: c.type, name: c.type === 'flock' ? c.name : 'Direct message', members: (c.members || []).length })),
    messagesYouSent: messages,
    sharedLocation: await get(`locations/${uid}`),
    sharedSchedule: await get(`schedules/${uid}`),
    sharedScheduleFull: await get(`schedulesFull/${uid}`),
    nearbyAlerts: await get(`nearby/${uid}`),
    classLists: await get(`classmates/${uid}`),
  };
  return { json: JSON.stringify(data, (k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function' ? v.toDate().toISOString() : v), 2) };
});
